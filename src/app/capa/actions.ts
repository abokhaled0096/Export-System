"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { withScopedTransaction } from "@/lib/scoped-prisma";
import { requireCurrentUser } from "@/lib/session";
import { requirePermission } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { logError, isNextControlFlowError, businessRuleMessage } from "@/lib/errorLog";
import { CAPA_ALL_STATUSES } from "@/lib/capaLabels";
import { assertWorkflowTransitionAllowed } from "@/lib/workflow";

const CAPA_ROOT_CAUSE_METHODS = ["FiveWhys", "Fishbone", "Other"] as const;

const CAPASchema = z.object({
  rootCause: z.string().trim().optional().or(z.literal("")),
  rootCauseMethod: z.enum(CAPA_ROOT_CAUSE_METHODS, "اختار طريقة تحليل صحيحة").optional().or(z.literal("")),
  correctiveAction: z.string().trim().optional().or(z.literal("")),
  preventiveAction: z.string().trim().optional().or(z.literal("")),
  dueDate: z.string().trim().optional().or(z.literal("")),
});

export type CAPAFormState = { errors?: Record<string, string[]>; formError?: string };

/** ownerId بيتحدَّد تلقائيًا بالمستخدم الحالي — نفس نمط BatchMarketEligibility.assessedBy.
 * verifiedBy بلا واجهة إدخال — نفس معاملة ProductSpecification.approvedBy. status دايمًا Open —
 * كان فورم بيسمح تختار من 3 حالات بداية (Open/InProgress/VerificationPending) بلا فايدة حقيقية،
 * الانتقال الفعلي بيحصل بعد كده عبر updateCAPAStatusAction (تدفّق WorkflowDefinition الحقيقي). */
export async function createCAPA(_prevState: CAPAFormState, formData: FormData): Promise<CAPAFormState> {
  const parsed = CAPASchema.safeParse({
    rootCause: formData.get("rootCause") || undefined,
    rootCauseMethod: formData.get("rootCauseMethod") || undefined,
    correctiveAction: formData.get("correctiveAction") || undefined,
    preventiveAction: formData.get("preventiveAction") || undefined,
    dueDate: formData.get("dueDate") || undefined,
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const user = await requireCurrentUser();
  const { rootCause, rootCauseMethod, correctiveAction, preventiveAction, dueDate, ...rest } = parsed.data;
  try {
    await requirePermission(user.roleId, "CAPA", "Create");
    await withScopedTransaction(async (tx) => {
      const capa = await tx.cAPA.create({
        data: {
          orgId: user.orgId,
          ownerId: user.id,
          status: "Open",
          rootCause: rootCause || undefined,
          rootCauseMethod: rootCauseMethod || undefined,
          correctiveAction: correctiveAction || undefined,
          preventiveAction: preventiveAction || undefined,
          dueDate: dueDate ? new Date(dueDate) : undefined,
          ...rest,
        },
      });
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "capa.created",
        entityType: "CAPA",
        entityId: capa.id,
        afterValue: { ...rest },
      });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "createCAPA", error: e });
    return { formError: "حصل خطأ أثناء إضافة الإجراء — حاول تاني." };
  }

  revalidatePath("/capa");
  return {};
}

/** انتقال حالة حقيقي — بس الانتقالات المسموح بيها في جدول WorkflowDefinition (وحدة 9، بدل
 * خريطة TS ثابتة، راجع STATUS.md 7 سبتمبر — نفس فلسفة زرار "ترحيل"/"عكس" في الدفتر: مش تعديل
 * حر لأي قيمة). verifiedBy بيتسجّل تلقائيًا بالمستخدم الحالي لحظة الانتقال لـEffective/Ineffective
 * — الـTrigger enforce_capa_verification برضه بيرفض أي محاولة توصل لحالة نهائية بلاه، فمفيش
 * مسار يلتف حول القاعدة حتى لو حصل خطأ هنا.
 * ⚠️ verifiedBy بيتصفّر لما الحالة ترجع InProgress (اكتُشف بعد إضافة انتقال Ineffective→InProgress،
 * 17 سبتمبر): من غير كده كان بيفضل معروض اسم آخر واحد تحقق منه حتى لو الإجراء اتفتح تاني للعمل —
 * تحقّق قديم بقى مالوش معنى، ولازم يتحقق منه تاني فعليًا قبل أي إقفال جديد. */
export async function updateCAPAStatusAction(capaId: string, newStatus: (typeof CAPA_ALL_STATUSES)[number]) {
  const user = await requireCurrentUser();
  await requirePermission(user.roleId, "CAPA", "Edit");

  try {
    await withScopedTransaction(async (tx) => {
      const capa = await tx.cAPA.findUniqueOrThrow({ where: { id: capaId } });
      if (capa.status !== newStatus) {
        await assertWorkflowTransitionAllowed(tx, user.orgId, "CAPA", capaId, capa.status, newStatus);
      }

      const needsVerification = newStatus === "Effective" || newStatus === "Ineffective";
      const verifiedBy = needsVerification ? user.id : newStatus === "InProgress" ? null : capa.verifiedBy;
      await tx.cAPA.update({
        where: { id: capaId },
        data: { status: newStatus, verifiedBy },
      });

      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "capa.statusChanged",
        entityType: "CAPA",
        entityId: capaId,
        beforeValue: { status: capa.status },
        afterValue: { status: newStatus },
      });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "updateCAPAStatusAction", error: e });
    throw new Error(businessRuleMessage(e, "حصل خطأ أثناء تعديل حالة الإجراء."));
  }

  revalidatePath(`/capa/${capaId}`);
  revalidatePath("/capa");
}
