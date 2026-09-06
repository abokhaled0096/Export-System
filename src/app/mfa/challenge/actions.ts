"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireCurrentUser } from "@/lib/session";

export type StepUpState = { formError?: string };

export async function verifyStepUp(
  next: string,
  _prevState: StepUpState,
  formData: FormData
): Promise<StepUpState> {
  const code = (formData.get("code") as string | null)?.trim();
  if (!code || code.length !== 6) return { formError: "الكود لازم يكون 6 أرقام." };

  await requireCurrentUser();
  const supabase = await createClient();
  const { data: factors } = await supabase.auth.mfa.listFactors();
  const factor = factors?.totp.find((f) => f.status === "verified");
  if (!factor) return { formError: "التحقق بخطوتين مش مفعّل على حسابك — فعّله الأول من /account/mfa." };

  const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
    factorId: factor.id,
  });
  if (challengeError || !challenge) return { formError: "حصل خطأ — حاول تاني." };

  const { error: verifyError } = await supabase.auth.mfa.verify({
    factorId: factor.id,
    challengeId: challenge.id,
    code,
  });
  if (verifyError) return { formError: "الكود غلط أو منتهي." };

  redirect(next.startsWith("/") ? next : "/");
}
