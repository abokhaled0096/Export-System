"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireCurrentUser } from "@/lib/session";

export type EnrollmentData = { factorId: string; qrCode: string; secret: string };

/** بيبدأ تفعيل TOTP — لو فيه عامل غير مُتحقَّق منه قديم (محاولة سابقة متعطّلة)، بيمسحه ويبدأ نظيف. */
export async function startEnrollment(): Promise<EnrollmentData | { error: string }> {
  await requireCurrentUser();
  const supabase = await createClient();

  const { data: factors } = await supabase.auth.mfa.listFactors();
  const stale = factors?.all.find((f) => f.factor_type === "totp" && f.status === "unverified");
  if (stale) {
    await supabase.auth.mfa.unenroll({ factorId: stale.id });
  }

  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: "تطبيق المصادقة",
  });
  if (error || !data) return { error: error?.message ?? "فشل بدء التفعيل — حاول تاني." };

  return { factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret };
}

export type VerifyEnrollmentState = { formError?: string; success?: boolean };

export async function verifyEnrollment(
  factorId: string,
  _prevState: VerifyEnrollmentState,
  formData: FormData
): Promise<VerifyEnrollmentState> {
  const code = (formData.get("code") as string | null)?.trim();
  if (!code || code.length !== 6) return { formError: "الكود لازم يكون 6 أرقام." };

  const supabase = await createClient();
  const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
  if (challengeError || !challenge) return { formError: "حصل خطأ — حاول تاني." };

  const { error: verifyError } = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challenge.id,
    code,
  });
  if (verifyError) return { formError: "الكود غلط أو منتهي — افتح تطبيق المصادقة وجرّب الكود الحالي." };

  revalidatePath("/account/mfa");
  return { success: true };
}

export async function unenrollFactor(factorId: string) {
  await requireCurrentUser();
  const supabase = await createClient();
  await supabase.auth.mfa.unenroll({ factorId });
  revalidatePath("/account/mfa");
}
