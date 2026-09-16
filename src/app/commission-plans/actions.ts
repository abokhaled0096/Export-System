"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { withScopedTransaction } from "@/lib/scoped-prisma";
import { requireCurrentUser } from "@/lib/session";
import { requirePermission } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { logError, isNextControlFlowError } from "@/lib/errorLog";

const COMMISSION_BASES = ["RevenuePercent", "GrossProfitPercent", "Tiered", "CollectionBased"] as const;
const COMMISSION_TRIGGER_EVENTS = ["OnWon", "OnInvoice", "OnCollection"] as const;

const CommissionPlanSchema = z.object({
  name: z.string().trim().min(1, "اسم الخطة مطلوب"),
  basis: z.enum(COMMISSION_BASES, "اختار أساس عمولة صحيح"),
  ratePct: z.coerce.number().min(0, "لازم يكون 0 أو أكتر").max(100, "لازم يكون 100 أو أقل").optional(),
  triggerEvent: z.enum(COMMISSION_TRIGGER_EVENTS, "اختار حدث استحقاق صحيح"),
});

export type CommissionPlanFormState = { errors?: Record<string, string[]>; formError?: string };

/** شريحة أساس Tiered — من (minAmount) إلى (maxAmount اختياري، فاضي = "وما فوق") بنسبة ratePct. */
const TierRowSchema = z.object({
  minAmount: z.coerce.number().min(0, "لازم يكون 0 أو أكتر"),
  maxAmount: z.coerce.number().min(0, "لازم يكون 0 أو أكتر").optional(),
  ratePct: z.coerce.number().min(0, "لازم يكون 0 أو أكتر").max(100, "لازم يكون 100 أو أقل"),
});

/** 3 شرايح ثابتة بس في الفورم (بدل مصفوفة ديناميكية غير محدودة) — كافية للغالبية الساحقة من
 * خطط العمولة المتدرّجة الحقيقية، وبتفادى تعقيد إدارة أسماء حقول مصفوفة في FormData. شريحة
 * فاضية بالكامل (كل حقولها فاضية) بتتجاهل بصمت. */
function parseTiers(formData: FormData): { tiers?: { minAmount: number; maxAmount?: number; ratePct: number }[]; error?: string } {
  const rows: { minAmount: number; maxAmount?: number; ratePct: number }[] = [];
  for (let i = 1; i <= 3; i++) {
    const minRaw = formData.get(`tier${i}Min`);
    const maxRaw = formData.get(`tier${i}Max`);
    const rateRaw = formData.get(`tier${i}Rate`);
    const isEmpty = !minRaw && !maxRaw && !rateRaw;
    if (isEmpty) continue;
    const parsed = TierRowSchema.safeParse({ minAmount: minRaw || undefined, maxAmount: maxRaw || undefined, ratePct: rateRaw || undefined });
    if (!parsed.success) return { error: `شريحة ${i}: لازم "من" و"النسبة %" على الأقل بقيم صحيحة.` };
    rows.push(parsed.data);
  }
  if (rows.length === 0) return {};

  rows.sort((a, b) => a.minAmount - b.minAmount);
  for (let i = 0; i < rows.length - 1; i++) {
    const current = rows[i];
    const next = rows[i + 1];
    if (current.maxAmount === undefined || current.maxAmount > next.minAmount) {
      return { error: `الشرايح لازم متكونش متداخلة — راجع الحد الأقصى للشريحة الأولى والحد الأدنى اللي بعدها.` };
    }
  }
  return { tiers: rows };
}

export async function createCommissionPlan(_prevState: CommissionPlanFormState, formData: FormData): Promise<CommissionPlanFormState> {
  const parsed = CommissionPlanSchema.safeParse({
    name: formData.get("name"),
    basis: formData.get("basis"),
    ratePct: formData.get("ratePct") || undefined,
    triggerEvent: formData.get("triggerEvent"),
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  if (parsed.data.basis !== "Tiered" && parsed.data.ratePct === undefined) {
    return { errors: { ratePct: ["النسبة % مطلوبة للأساس ده"] } };
  }

  // الشرايح لها معنى لأساس Tiered بس — بتتجاهل بصمت لأي أساس تاني حتى لو اتملّت غلط في الفورم
  // (مخفية أصلًا في الواجهة إلا لما تختار Tiered، راجع CommissionPlanForm.tsx).
  const tiersResult = parsed.data.basis === "Tiered" ? parseTiers(formData) : {};
  if (tiersResult.error) return { formError: tiersResult.error };
  if (parsed.data.basis === "Tiered" && !tiersResult.tiers) {
    return { formError: "لازم تدخل شريحة واحدة على الأقل لأساس متدرّج." };
  }

  const user = await requireCurrentUser();
  try {
    await requirePermission(user.roleId, "CommissionPlan", "Create");
    await withScopedTransaction(async (tx) => {
      const plan = await tx.commissionPlan.create({
        data: { orgId: user.orgId, ...parsed.data, tiers: tiersResult.tiers },
      });
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "commissionPlan.created",
        entityType: "CommissionPlan",
        entityId: plan.id,
        afterValue: { ...parsed.data, tiers: tiersResult.tiers },
      });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "createCommissionPlan", error: e });
    return { formError: "حصل خطأ أثناء إضافة خطة العمولة — حاول تاني." };
  }

  revalidatePath("/commission-plans");
  return {};
}
