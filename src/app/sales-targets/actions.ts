"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { withScopedTransaction } from "@/lib/scoped-prisma";
import { requireCurrentUser } from "@/lib/session";
import { requirePermission } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { logError, isNextControlFlowError } from "@/lib/errorLog";

const SALES_TARGET_TYPES = ["Revenue", "Volume", "DealsCount"] as const;

const SalesTargetSchema = z.object({
  userId: z.string().uuid().optional().or(z.literal("")),
  teamId: z.string().uuid().optional().or(z.literal("")),
  period: z.string().trim().min(1, "الفترة مطلوبة"),
  targetType: z.enum(SALES_TARGET_TYPES),
  targetValue: z.coerce.number().positive("القيمة المستهدفة مطلوبة"),
  currency: z.string().trim().length(3).toUpperCase().optional().or(z.literal("")),
});

export type SalesTargetFormState = { errors?: Record<string, string[]>; formError?: string };

export async function createSalesTarget(_prevState: SalesTargetFormState, formData: FormData): Promise<SalesTargetFormState> {
  const parsed = SalesTargetSchema.safeParse({
    userId: formData.get("userId") || undefined,
    teamId: formData.get("teamId") || undefined,
    period: formData.get("period"),
    targetType: formData.get("targetType"),
    targetValue: formData.get("targetValue"),
    currency: formData.get("currency") || undefined,
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const user = await requireCurrentUser();
  const { userId, teamId, currency, ...rest } = parsed.data;
  try {
    await requirePermission(user.roleId, "SalesTarget", "Create");
    await withScopedTransaction(async (tx) => {
      const target = await tx.salesTarget.create({
        data: {
          orgId: user.orgId,
          userId: userId || undefined,
          teamId: teamId || undefined,
          currency: currency || undefined,
          ...rest,
        },
      });
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "salesTarget.created",
        entityType: "SalesTarget",
        entityId: target.id,
        afterValue: { userId: userId || null, teamId: teamId || null, ...rest },
      });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "createSalesTarget", error: e });
    return { formError: "حصل خطأ أثناء إضافة الهدف — حاول تاني." };
  }

  revalidatePath("/sales-targets");
  return {};
}
