"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getScopedPrisma, withScopedTransaction } from "@/lib/scoped-prisma";
import { requireCurrentUser } from "@/lib/session";
import { requirePermission } from "@/lib/permissions";
import { requireAal2 } from "@/lib/mfa";
import { logAudit } from "@/lib/audit";
import { logError, isNextControlFlowError, businessRuleMessage } from "@/lib/errorLog";
import { encryptSecret, updateSecret, deleteSecret } from "@/lib/vault";

const AiSettingsSchema = z.object({
  apiKey: z.string().trim().optional().or(z.literal("")),
  baseUrl: z.string().trim().optional().or(z.literal("")),
  model: z.string().trim().optional().or(z.literal("")),
});

export type AiSettingsFormState = { errors?: Record<string, string[]>; formError?: string; mfaRequired?: boolean; success?: boolean };

/** بيحدّث إعدادات الذكاء الاصطناعي للمنظمة (مفتاح مشفّر عبر Vault + Base URL + موديل) — نفس نمط
 * updateSupplierBankInfoAction بالحرف (src/app/suppliers/actions.ts). حقل فاضي = سيبه زي ما هو
 * (مفيش مسح ضمني)؛ مسح المفتاح المخصّص فعل صريح منفصل (clearAiApiKeyAction تحت). MFA إلزامي —
 * المفتاح ده بيتحكم في تكلفة/وصول خارجي على مستوى المنظمة كلها. */
export async function updateAiSettingsAction(
  _prevState: AiSettingsFormState,
  formData: FormData
): Promise<AiSettingsFormState> {
  const parsed = AiSettingsSchema.safeParse({
    apiKey: formData.get("apiKey") || undefined,
    baseUrl: formData.get("baseUrl") || undefined,
    model: formData.get("model") || undefined,
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const { apiKey, baseUrl, model } = parsed.data;
  if (!apiKey && baseUrl === undefined && model === undefined) return { formError: "دخّل قيمة واحدة على الأقل." };

  const user = await requireCurrentUser();
  try {
    await requirePermission(user.roleId, "User", "Edit");
  } catch {
    return { formError: "معندكش صلاحية تعديل إعدادات الذكاء الاصطناعي." };
  }
  try {
    await requireAal2();
  } catch {
    return { formError: "تعديل إعدادات الذكاء الاصطناعي محتاج تحقق بخطوتين (MFA) الأول.", mfaRequired: true };
  }

  try {
    const scopedPrisma = await getScopedPrisma();
    const org = await scopedPrisma.organization.findUniqueOrThrow({ where: { id: user.orgId } });

    // التشفير برّه الـtransaction عمدًا — vault.* بيفتح transaction منفصلة لكل نداء (راجع
    // src/lib/vault.ts)، فمفيش فايدة من لفّها في نفس transaction تحديث الصف.
    const updates: { aiApiKeySecretId?: string; aiBaseUrl?: string | null; aiModel?: string | null } = {};
    if (apiKey) {
      updates.aiApiKeySecretId = org.aiApiKeySecretId
        ? await updateSecret(org.aiApiKeySecretId, apiKey).then(() => org.aiApiKeySecretId!)
        : await encryptSecret(apiKey, `Organization ${user.orgId} aiApiKey`);
    }
    if (baseUrl !== undefined) updates.aiBaseUrl = baseUrl || null;
    if (model !== undefined) updates.aiModel = model || null;

    await withScopedTransaction(async (tx) => {
      await tx.organization.update({ where: { id: user.orgId }, data: updates });
      // ممنوع تسجيل المفتاح نفسه في الـAuditLog — بس تسجيل إن التعديل حصل ومين عمله.
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "organization.aiSettingsUpdated",
        entityType: "Organization",
        entityId: user.orgId,
        afterValue: { fieldsUpdated: Object.keys(updates) },
      });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "updateAiSettingsAction", error: e });
    return { formError: businessRuleMessage(e, "حصل خطأ أثناء حفظ الإعدادات — حاول تاني.") };
  }

  revalidatePath("/admin/ai-settings");
  return { success: true };
}

export type ClearAiKeyState = { formError?: string; mfaRequired?: boolean; success?: boolean };

/** بيمسح المفتاح المخصّص ويرجّع المنظمة تستخدم OPENAI_API_KEY من .env — فعل صريح منفصل عمدًا
 * (مش مجرد حقل فاضي في الفورم اللي بيتفسّر "سيبه زي ما هو"). */
export async function clearAiApiKeyAction(): Promise<ClearAiKeyState> {
  const user = await requireCurrentUser();
  try {
    await requirePermission(user.roleId, "User", "Edit");
  } catch {
    return { formError: "معندكش صلاحية تعديل إعدادات الذكاء الاصطناعي." };
  }
  try {
    await requireAal2();
  } catch {
    return { formError: "مسح مفتاح الذكاء الاصطناعي محتاج تحقق بخطوتين (MFA) الأول.", mfaRequired: true };
  }

  try {
    const scopedPrisma = await getScopedPrisma();
    const org = await scopedPrisma.organization.findUniqueOrThrow({ where: { id: user.orgId } });
    if (!org.aiApiKeySecretId) return { success: true };

    const secretId = org.aiApiKeySecretId;
    await withScopedTransaction(async (tx) => {
      await tx.organization.update({ where: { id: user.orgId }, data: { aiApiKeySecretId: null } });
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "organization.aiApiKeyCleared",
        entityType: "Organization",
        entityId: user.orgId,
      });
    });
    // حذف الـsecret نفسه بعد ما الصف بقى مش بيشاور عليه — best-effort، لو فشل الحذف الفعلي في
    // Vault، الأهم إن الصف بقى مش بيستخدمه بقى (تم فعليًا في الـtransaction اللي فاتت).
    await deleteSecret(secretId).catch(() => {});
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "clearAiApiKeyAction", error: e });
    return { formError: businessRuleMessage(e, "حصل خطأ أثناء مسح المفتاح — حاول تاني.") };
  }

  revalidatePath("/admin/ai-settings");
  return { success: true };
}
