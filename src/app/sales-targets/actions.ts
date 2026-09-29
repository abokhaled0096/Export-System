"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { withScopedTransaction } from "@/lib/scoped-prisma";
import { requireCurrentUser } from "@/lib/session";
import { requirePermission } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { logError, isNextControlFlowError } from "@/lib/errorLog";
import { computeSalesTargetActual } from "@/lib/salesTargetEngine";
import { optionalCurrencySchema } from "@/lib/currencySchema";

const SALES_TARGET_TYPES = ["Revenue", "Volume", "DealsCount"] as const;

const SalesTargetSchema = z.object({
  userId: z.string().uuid().optional().or(z.literal("")),
  teamId: z.string().uuid().optional().or(z.literal("")),
  period: z.string().trim().min(1, "الفترة مطلوبة"),
  // periodStart/periodEnd اختياريين عمدًا — هدف بلاهم يتسجّل عادي (زي قبل كده بالحرف)، بس
  // actualValue بتاعه هيفضل غير قابل للحساب (null) لحد ما يتحدَّث بمدى صريح. راجع
  // src/lib/salesTargetEngine.ts للسبب الكامل.
  periodStart: z.string().trim().optional().or(z.literal("")),
  periodEnd: z.string().trim().optional().or(z.literal("")),
  targetType: z.enum(SALES_TARGET_TYPES, "اختار نوع هدف مبيعات صحيح"),
  targetValue: z.coerce.number().positive("القيمة المستهدفة مطلوبة"),
  currency: optionalCurrencySchema,
});

export type SalesTargetFormState = { errors?: Record<string, string[]>; formError?: string };

export async function createSalesTarget(_prevState: SalesTargetFormState, formData: FormData): Promise<SalesTargetFormState> {
  const parsed = SalesTargetSchema.safeParse({
    userId: formData.get("userId") || undefined,
    teamId: formData.get("teamId") || undefined,
    period: formData.get("period"),
    periodStart: formData.get("periodStart") || undefined,
    periodEnd: formData.get("periodEnd") || undefined,
    targetType: formData.get("targetType"),
    targetValue: formData.get("targetValue"),
    currency: formData.get("currency") || undefined,
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const user = await requireCurrentUser();
  const { userId, teamId, currency, periodStart, periodEnd, ...rest } = parsed.data;
  if ((periodStart && !periodEnd) || (!periodStart && periodEnd)) {
    return { formError: "لازم تحدّد بداية ونهاية المدى مع بعض، أو تسيبهم فاضيين خالص." };
  }
  try {
    await requirePermission(user.roleId, "SalesTarget", "Create");
    await withScopedTransaction(async (tx) => {
      const target = await tx.salesTarget.create({
        data: {
          orgId: user.orgId,
          userId: userId || undefined,
          teamId: teamId || undefined,
          currency: currency || undefined,
          periodStart: periodStart ? new Date(periodStart) : undefined,
          periodEnd: periodEnd ? new Date(periodEnd) : undefined,
          ...rest,
        },
      });
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "salesTarget.created",
        entityType: "SalesTarget",
        entityId: target.id,
        afterValue: { userId: userId || null, teamId: teamId || null, periodStart: periodStart || null, periodEnd: periodEnd || null, ...rest },
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

/** بيعيد حساب القيمة الفعلية من أوامر البيع الحقيقية — بلا أي أثر محاسبي (مجرد تحديث عمود
 * ملخّص)، فآمن يتنادى في أي وقت. بيرجع null لو الهدف بلا periodStart/periodEnd (راجع
 * src/lib/salesTargetEngine.ts) بدل ما يسجّل صفر مضلِّل. */
export async function recomputeSalesTargetActualAction(targetId: string): Promise<{ formError?: string }> {
  const user = await requireCurrentUser();
  await requirePermission(user.roleId, "SalesTarget", "Create");

  try {
    await withScopedTransaction(async (tx) => {
      const target = await tx.salesTarget.findUniqueOrThrow({ where: { id: targetId } });
      const result = await computeSalesTargetActual(tx, target);
      await tx.salesTarget.update({ where: { id: targetId }, data: { actualValue: result.value } });
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "salesTarget.actualRecomputed",
        entityType: "SalesTarget",
        entityId: targetId,
        afterValue: { actualValue: result.value?.toString() ?? null, matchedOrderCount: result.matchedOrderCount, excludedByCurrencyCount: result.excludedByCurrencyCount },
      });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "recomputeSalesTargetActualAction", error: e });
    return { formError: "حصل خطأ أثناء إعادة الحساب — حاول تاني." };
  }

  revalidatePath("/sales-targets");
  return {};
}
