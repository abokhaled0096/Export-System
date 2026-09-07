"use server";

import { z } from "zod";
import { requireCurrentUser } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

const ChangePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "كلمة السر الحالية مطلوبة"),
    newPassword: z.string().min(6, "كلمة المرور قصيرة جدًا"),
    confirmPassword: z.string().min(1, "أكّد كلمة السر الجديدة"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "كلمة السر الجديدة والتأكيد مش متطابقين",
    path: ["confirmPassword"],
  });

export type ChangePasswordFormState = { errors?: Record<string, string[]>; formError?: string; success?: boolean };

/** بيتحقّق من كلمة السر الحالية الأول (signInWithPassword) قبل التغيير — نفس المبدأ المتّبع في أي
 * فورم تغيير كلمة سر ذاتي، عشان جلسة مسروقة/جهاز مفتوح متسيبش مايستولوش على الحساب بصمت. */
export async function updateMyPasswordAction(
  _prevState: ChangePasswordFormState,
  formData: FormData
): Promise<ChangePasswordFormState> {
  const parsed = ChangePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const user = await requireCurrentUser();
  const supabase = await createClient();

  const { error: reauthError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: parsed.data.currentPassword,
  });
  if (reauthError) return { formError: "كلمة السر الحالية غلط." };

  const { error } = await supabase.auth.updateUser({ password: parsed.data.newPassword });
  if (error) return { formError: `حصل خطأ أثناء تغيير كلمة السر: ${error.message}` };

  return { success: true };
}
