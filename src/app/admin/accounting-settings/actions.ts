"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getScopedPrisma } from "@/lib/scoped-prisma";
import { requireCurrentUser } from "@/lib/session";
import { requirePermission } from "@/lib/permissions";
import { requireAal2 } from "@/lib/mfa";
import { logAudit } from "@/lib/audit";
import { logError, isNextControlFlowError, businessRuleMessage } from "@/lib/errorLog";

const AccountingSettingsSchema = z.object({
  functionalCurrency: z.string().trim().length(3, "لازم 3 حروف (ISO 4217)").toUpperCase().optional().or(z.literal("")),
});

export type AccountingSettingsFormState = { errors?: Record<string, string[]>; formError?: string; mfaRequired?: boolean; success?: boolean };

/** تفعيل العملة الوظيفية (functionalCurrency) بيحوّل سلوك الترحيل المحاسبي كله — قيود متعددة
 * العملات بقت ممكنة، ومحرك فروق العملة (postPaymentAllocated/fxRevaluation) بيشتغل. نفس نمط
 * updateAiSettingsAction بالحرف: User.Edit + MFA إلزامي — قرار بهذا الحجم يستاهل نفس الحراسة. */
export async function updateAccountingSettingsAction(
  _prevState: AccountingSettingsFormState,
  formData: FormData
): Promise<AccountingSettingsFormState> {
  const parsed = AccountingSettingsSchema.safeParse({
    functionalCurrency: formData.get("functionalCurrency") || undefined,
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const user = await requireCurrentUser();
  try {
    await requirePermission(user.roleId, "User", "Edit");
  } catch {
    return { formError: "معندكش صلاحية تعديل إعدادات المحاسبة." };
  }
  try {
    await requireAal2();
  } catch {
    return { formError: "تعديل العملة الوظيفية محتاج تحقق بخطوتين (MFA) الأول.", mfaRequired: true };
  }

  try {
    const scopedPrisma = await getScopedPrisma();
    const org = await scopedPrisma.organization.findUniqueOrThrow({ where: { id: user.orgId } });

    await scopedPrisma.organization.update({
      where: { id: user.orgId },
      data: { functionalCurrency: parsed.data.functionalCurrency || null },
    });
    await logAudit(scopedPrisma, {
      orgId: user.orgId,
      userId: user.id,
      action: "organization.functionalCurrency.updated",
      entityType: "Organization",
      entityId: user.orgId,
      beforeValue: { functionalCurrency: org.functionalCurrency },
      afterValue: { functionalCurrency: parsed.data.functionalCurrency || null },
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "updateAccountingSettingsAction", error: e });
    return { formError: businessRuleMessage(e, "حصل خطأ أثناء تحديث الإعدادات — حاول تاني.") };
  }

  revalidatePath("/admin/accounting-settings");
  return { success: true };
}
