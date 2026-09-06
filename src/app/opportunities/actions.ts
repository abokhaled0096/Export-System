"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getScopedPrisma, withScopedTransaction } from "@/lib/scoped-prisma";
import { requireCurrentUser } from "@/lib/session";
import { requirePermission, assertOwnScope } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { logError, isNextControlFlowError, businessRuleMessage } from "@/lib/errorLog";
import { OPPORTUNITY_STAGE_TRANSITIONS, OPPORTUNITY_ALL_STAGES } from "@/lib/opportunityLabels";

const OpportunitySchema = z.object({
  companyId: z.string().uuid("اختر شركة"),
  contactId: z.string().uuid().optional().or(z.literal("")),
  productId: z.string().uuid("اختر منتج"),
  marketId: z.string().uuid("اختر سوق"),
  expectedValue: z.coerce.number().positive().optional(),
  currency: z.string().trim().length(3).toUpperCase().optional().or(z.literal("")),
  indicativeIncoterm: z.string().trim().optional(),
});

export type OpportunityFormState = {
  errors?: Partial<Record<keyof z.infer<typeof OpportunitySchema>, string[]>>;
  formError?: string;
};

export async function createOpportunity(
  _prevState: OpportunityFormState,
  formData: FormData
): Promise<OpportunityFormState> {
  const parsed = OpportunitySchema.safeParse({
    companyId: formData.get("companyId"),
    contactId: formData.get("contactId") || undefined,
    productId: formData.get("productId"),
    marketId: formData.get("marketId"),
    expectedValue: formData.get("expectedValue") || undefined,
    currency: formData.get("currency") || undefined,
    indicativeIncoterm: formData.get("indicativeIncoterm") || undefined,
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  // requireCurrentUser() بيعمل redirect() داخليًا لو الجلسة انتهت — لازم يكون برّه try/catch.
  const user = await requireCurrentUser();
  try {
    const scope = await requirePermission(user.roleId, "Opportunity", "Create");
    const scopedPrisma = await getScopedPrisma();
    const company = await scopedPrisma.company.findUniqueOrThrow({
      where: { id: parsed.data.companyId },
      select: { ownerId: true },
    });
    await assertOwnScope(scope, company.ownerId, user);

    const { contactId, currency, ...rest } = parsed.data;
    await withScopedTransaction(async (tx) => {
      // الفرصة الجديدة بتبقى ملك المستخدم اللي أنشأها — أساس فحص Own scope على Deal التابعة ليها.
      const opportunity = await tx.opportunity.create({
        data: {
          orgId: user.orgId,
          ...rest,
          contactId: contactId || undefined,
          currency: currency || undefined,
          stage: "NewLead",
          ownerId: user.id,
        },
      });
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "opportunity.created",
        entityType: "Opportunity",
        entityId: opportunity.id,
        afterValue: { ...rest, contactId: contactId || undefined, stage: "NewLead" },
      });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "createOpportunity", error: e });
    return { formError: "حصل خطأ أثناء الحفظ — حاول تاني." };
  }

  revalidatePath("/opportunities");
  revalidatePath(`/companies/${parsed.data.companyId}`);
  redirect("/opportunities");
}

const ArchiveOpportunitySchema = z.string().uuid();

export async function archiveOpportunity(opportunityId: string) {
  const parsed = ArchiveOpportunitySchema.safeParse(opportunityId);
  if (!parsed.success) throw new Error("معرّف فرصة غير صالح.");

  const user = await requireCurrentUser();
  const scope = await requirePermission(user.roleId, "Opportunity", "Edit");
  const scopedPrisma = await getScopedPrisma();
  const opportunity = await scopedPrisma.opportunity.findFirst({ where: { id: parsed.data, orgId: user.orgId } });
  if (!opportunity) throw new Error("الفرصة غير موجودة.");
  await assertOwnScope(scope, opportunity.ownerId, user);

  try {
    await withScopedTransaction(async (tx) => {
      await tx.opportunity.update({ where: { id: parsed.data }, data: { deletedAt: new Date() } });
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "opportunity.archived",
        entityType: "Opportunity",
        entityId: parsed.data,
      });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "archiveOpportunity", error: e });
    throw new Error("حصل خطأ أثناء الأرشفة — حاول تاني.");
  }

  revalidatePath("/opportunities");
  revalidatePath("/opportunities/archived");
}

/** انتقال مرحلة حقيقي — بس الأزواج المسموح بيها في OPPORTUNITY_STAGE_TRANSITIONS (نفس فلسفة
 * updateCAPAStatusAction: مش تعديل حر لأي قيمة). `createOpportunity` بيثبّت stage=NewLead
 * دايمًا، وده أول مسار تعديل حقيقي له — أول ما اتبنى، Trigger enforce_opportunity_rfq_before_quote
 * على مستوى القاعدة بقى قابل للانتهاك فعليًا (كان مؤجَّل عمدًا لغياب المسار ده، راجع BACKLOG.md). */
export async function updateOpportunityStageAction(opportunityId: string, newStage: (typeof OPPORTUNITY_ALL_STAGES)[number]) {
  const user = await requireCurrentUser();
  const scope = await requirePermission(user.roleId, "Opportunity", "Edit");

  try {
    await withScopedTransaction(async (tx) => {
      const opportunity = await tx.opportunity.findUniqueOrThrow({ where: { id: opportunityId } });
      await assertOwnScope(scope, opportunity.ownerId, user);

      const allowed = OPPORTUNITY_STAGE_TRANSITIONS[opportunity.stage] ?? [];
      if (!allowed.includes(newStage)) {
        throw new Error(`مينفعش الانتقال من "${opportunity.stage}" لـ"${newStage}" مباشرة.`);
      }

      await tx.opportunity.update({ where: { id: opportunityId }, data: { stage: newStage } });
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "opportunity.stageChanged",
        entityType: "Opportunity",
        entityId: opportunityId,
        beforeValue: { stage: opportunity.stage },
        afterValue: { stage: newStage },
      });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "updateOpportunityStageAction", error: e });
    throw new Error(businessRuleMessage(e, "حصل خطأ أثناء تغيير مرحلة الفرصة."));
  }

  revalidatePath(`/opportunities/${opportunityId}`);
  revalidatePath("/opportunities");
}

const RestoreOpportunitySchema = z.string().uuid();

export async function restoreOpportunity(opportunityId: string) {
  const parsed = RestoreOpportunitySchema.safeParse(opportunityId);
  if (!parsed.success) throw new Error("معرّف فرصة غير صالح.");

  const user = await requireCurrentUser();
  const scope = await requirePermission(user.roleId, "Opportunity", "Edit");
  const scopedPrisma = await getScopedPrisma();
  const opportunity = await scopedPrisma.opportunity.findFirst({ where: { id: parsed.data, orgId: user.orgId } });
  if (!opportunity) throw new Error("الفرصة غير موجودة.");
  await assertOwnScope(scope, opportunity.ownerId, user);

  try {
    await withScopedTransaction(async (tx) => {
      await tx.opportunity.update({ where: { id: parsed.data }, data: { deletedAt: null } });
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "opportunity.restored",
        entityType: "Opportunity",
        entityId: parsed.data,
      });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "restoreOpportunity", error: e });
    throw new Error("حصل خطأ أثناء الاستعادة — حاول تاني.");
  }

  revalidatePath("/opportunities");
  revalidatePath("/opportunities/archived");
}
