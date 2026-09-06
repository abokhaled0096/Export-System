"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { requireCurrentUser } from "@/lib/session";
import { requirePermission } from "@/lib/permissions";
import { requireAal2 } from "@/lib/mfa";
import { withScopedTransaction } from "@/lib/scoped-prisma";
import { logAudit } from "@/lib/audit";
import { logError, isNextControlFlowError } from "@/lib/errorLog";

const QuoteOverridePayload = z.object({
  scenarioId: z.string().uuid(),
  dealId: z.string().uuid(),
  customerId: z.string().uuid(),
  currency: z.string(),
  incoterm: z.enum(["EXW", "FCA", "FAS", "FOB", "CFR", "CIF", "CPT", "CIP", "DAP", "DPU", "DDP"]),
  namedPlace: z.string().nullable(),
  unitPrice: z.number(),
  priceUnit: z.string(),
  validUntil: z.string().nullable(),
});

/** وحدة 5 — تجاوز بوابة امتثال (Gate.waiver). الـGate نفسه موجود بالفعل وقت الطلب (عكس Quote
 * اللي بيتعمل بعد الاعتماد بـsubjectId محجوز) — الاعتماد بس بيحدّث status/approvalId عليه. */
const GateWaiverPayload = z.object({
  dealId: z.string().uuid(),
  complianceCaseId: z.string().uuid(),
  gateName: z.string(),
});

/** وحدة 7 — تجاوز maximumPurchasePrice (PurchaseOrder.unitPrice_override). نفس نمط Quote بالظبط:
 * subjectId محجوز مسبقًا، الـPurchaseOrder الفعلي بيتعمل بعد الاعتماد بنفس الـid. */
const PurchaseOrderOverridePayload = z.object({
  sourcingRequestId: z.string().uuid(),
  dealId: z.string().uuid(),
  supplierId: z.string().uuid(),
  facilityId: z.string().uuid().nullable(),
  specificationId: z.string().uuid().nullable().optional(),
  quantity: z.number(),
  unitPrice: z.number(),
  currency: z.string(),
  paymentTerms: z.string().nullable(),
  penalties: z.string().nullable(),
  maximumPurchasePrice: z.string(),
});

export type DecideApprovalState = { formError?: string; mfaRequired?: boolean };

/** يعتمد طلب موافقة استثنائية — بينشئ الـQuote فعليًا (بنفس subjectId المحجوز) لو النوع Quote.unitPrice_override. */
export async function approveRequest(
  approvalId: string,
  _prevState: DecideApprovalState,
  formData: FormData
): Promise<DecideApprovalState> {
  const reason = (formData.get("reason") as string | null)?.trim() || undefined;
  const user = await requireCurrentUser();
  try {
    await requirePermission(user.roleId, "Approval", "Approve");
  } catch {
    return { formError: "معندكش صلاحية اعتماد الموافقات." };
  }
  try {
    await requireAal2();
  } catch {
    return { formError: "اعتماد موافقة استثنائية محتاج تحقق بخطوتين (MFA) الأول.", mfaRequired: true };
  }

  try {
    await withScopedTransaction(async (tx) => {
      const approval = await tx.approval.findUniqueOrThrow({ where: { id: approvalId } });
      if (approval.decision !== "Pending") throw new Error("الطلب ده اتقرر فيه بالفعل.");

      await tx.approval.update({
        where: { id: approvalId },
        data: { decision: "Approved", decidedBy: user.id, decidedAt: new Date(), reason },
      });

      if (approval.subjectType === "Quote.unitPrice_override") {
        const p = QuoteOverridePayload.parse(approval.payload);
        const lastVersion = await tx.quote.findFirst({
          where: { dealId: p.dealId },
          orderBy: { version: "desc" },
          select: { version: true },
        });
        const quote = await tx.quote.create({
          data: {
            id: approval.subjectId,
            orgId: user.orgId,
            dealId: p.dealId,
            scenarioId: p.scenarioId,
            version: (lastVersion?.version ?? 0) + 1,
            customerId: p.customerId,
            currency: p.currency,
            incoterm: p.incoterm,
            namedPlace: p.namedPlace ?? undefined,
            unitPrice: new Prisma.Decimal(p.unitPrice),
            priceUnit: p.priceUnit,
            validUntil: p.validUntil ? new Date(p.validUntil) : undefined,
            approvalId: approval.id,
          },
        });
        const deal = await tx.deal.findUniqueOrThrow({ where: { id: p.dealId } });
        if (deal.status === "Draft" || deal.status === "Pricing") {
          await tx.deal.update({ where: { id: p.dealId }, data: { status: "Negotiation" } });
        }
        await logAudit(tx, {
          orgId: user.orgId,
          userId: user.id,
          action: "quote.created",
          entityType: "Quote",
          entityId: quote.id,
          afterValue: { scenarioId: p.scenarioId, unitPrice: p.unitPrice, viaApproval: approval.id },
        });
      } else if (approval.subjectType === "Gate.waiver") {
        const p = GateWaiverPayload.parse(approval.payload);
        // Trigger gate_waiver_requires_approval بيتحقق إن approvalId ده فعلًا Approved — بما إننا
        // زوّدنا Approval.decision فوق في نفس الـtransaction، الشرط بيتحقق صح.
        await tx.gate.update({
          where: { id: approval.subjectId },
          data: { status: "Waived", approvalId: approval.id },
        });
        await logAudit(tx, {
          orgId: user.orgId,
          userId: user.id,
          action: "gate.waived",
          entityType: "Gate",
          entityId: approval.subjectId,
          afterValue: { complianceCaseId: p.complianceCaseId, viaApproval: approval.id },
        });
      } else if (approval.subjectType === "PurchaseOrder.unitPrice_override") {
        const p = PurchaseOrderOverridePayload.parse(approval.payload);
        const year = new Date().getFullYear();
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`po-number-${user.orgId}-${year}`}))`;
        const countThisYear = await tx.purchaseOrder.count({ where: { orgId: user.orgId, poNumber: { startsWith: `PO-${year}-` } } });
        const poNumber = `PO-${year}-${String(countThisYear + 1).padStart(4, "0")}`;

        const po = await tx.purchaseOrder.create({
          data: {
            id: approval.subjectId,
            orgId: user.orgId,
            sourcingRequestId: p.sourcingRequestId,
            supplierId: p.supplierId,
            facilityId: p.facilityId ?? undefined,
            specificationId: p.specificationId ?? undefined,
            poNumber,
            quantity: new Prisma.Decimal(p.quantity),
            unitPrice: new Prisma.Decimal(p.unitPrice),
            currency: p.currency,
            paymentTerms: p.paymentTerms ?? undefined,
            penalties: p.penalties ?? undefined,
            approvalId: approval.id,
          },
        });
        await tx.sourcingRequest.update({ where: { id: p.sourcingRequestId }, data: { status: "POIssued" } });
        await logAudit(tx, {
          orgId: user.orgId,
          userId: user.id,
          action: "purchaseOrder.created",
          entityType: "PurchaseOrder",
          entityId: po.id,
          afterValue: { sourcingRequestId: p.sourcingRequestId, poNumber, unitPrice: p.unitPrice, viaApproval: approval.id },
        });
      }

      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "approval.approved",
        entityType: "Approval",
        entityId: approvalId,
        afterValue: { reason },
      });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "approveRequest", error: e });
    return { formError: e instanceof Error ? e.message : "حصل خطأ أثناء اعتماد الطلب — حاول تاني." };
  }

  revalidatePath("/approvals");
  revalidatePath("/deals");
  revalidatePath("/compliance");
  revalidatePath("/sourcing");
  return {};
}

export async function rejectRequest(
  approvalId: string,
  _prevState: DecideApprovalState,
  formData: FormData
): Promise<DecideApprovalState> {
  const reason = (formData.get("reason") as string | null)?.trim();
  if (!reason) return { formError: "سبب الرفض مطلوب." };

  const user = await requireCurrentUser();
  try {
    await requirePermission(user.roleId, "Approval", "Approve");
  } catch {
    return { formError: "معندكش صلاحية اعتماد الموافقات." };
  }
  try {
    await requireAal2();
  } catch {
    return { formError: "رفض موافقة استثنائية محتاج تحقق بخطوتين (MFA) الأول.", mfaRequired: true };
  }

  try {
    await withScopedTransaction(async (tx) => {
      const approval = await tx.approval.findUniqueOrThrow({ where: { id: approvalId } });
      if (approval.decision !== "Pending") throw new Error("الطلب ده اتقرر فيه بالفعل.");

      await tx.approval.update({
        where: { id: approvalId },
        data: { decision: "Rejected", decidedBy: user.id, decidedAt: new Date(), reason },
      });
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "approval.rejected",
        entityType: "Approval",
        entityId: approvalId,
        afterValue: { reason },
      });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "rejectRequest", error: e });
    return { formError: e instanceof Error ? e.message : "حصل خطأ أثناء رفض الطلب — حاول تاني." };
  }

  revalidatePath("/approvals");
  return {};
}
