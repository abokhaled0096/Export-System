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
  basis: z.enum(COMMISSION_BASES),
  ratePct: z.coerce.number().min(0).max(100).optional(),
  triggerEvent: z.enum(COMMISSION_TRIGGER_EVENTS),
});

export type CommissionPlanFormState = { errors?: Record<string, string[]>; formError?: string };

export async function createCommissionPlan(_prevState: CommissionPlanFormState, formData: FormData): Promise<CommissionPlanFormState> {
  const parsed = CommissionPlanSchema.safeParse({
    name: formData.get("name"),
    basis: formData.get("basis"),
    ratePct: formData.get("ratePct") || undefined,
    triggerEvent: formData.get("triggerEvent"),
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const user = await requireCurrentUser();
  try {
    await requirePermission(user.roleId, "CommissionPlan", "Create");
    await withScopedTransaction(async (tx) => {
      const plan = await tx.commissionPlan.create({
        data: { orgId: user.orgId, ...parsed.data },
      });
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "commissionPlan.created",
        entityType: "CommissionPlan",
        entityId: plan.id,
        afterValue: { ...parsed.data },
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
