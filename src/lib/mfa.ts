import { createClient } from "./supabase/server";

/**
 * مستوى التحقق (Authenticator Assurance Level) للجلسة الحالية — `aal1` = كلمة مرور بس،
 * `aal2` = اتأكدت بعامل تاني (TOTP) كمان. راجع القاعدة غير القابلة للتفاوض في CLAUDE.md
 * (§قواعد أمان): أي عملية حساسة (اعتماد سعر، تجاوز walkAwayPrice، بيانات بنكية) لازم aal2.
 */
export async function getAal(): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error || !data) return null;
  return data.currentLevel;
}

/** يرمي لو الجلسة مش aal2 — استخدمها في أول أي Server Action حساس. الرسالة sentinel
 * (`MFA_REQUIRED`) عشان الـcaller يقدر يميّزها ويحوّل لصفحة `/mfa/challenge` بدل رسالة عامة. */
export async function requireAal2() {
  const level = await getAal();
  if (level !== "aal2") {
    throw new Error("MFA_REQUIRED");
  }
}
