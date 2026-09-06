"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const LoginSchema = z.object({
  email: z.string().trim().email("إيميل غير صالح"),
  password: z.string().min(6, "كلمة المرور قصيرة جدًا"),
  next: z.string().optional(),
});

export type LoginFormState = { formError?: string };

export async function login(
  _prevState: LoginFormState,
  formData: FormData
): Promise<LoginFormState> {
  const parsed = LoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next") || undefined,
  });

  if (!parsed.success) {
    return { formError: "البيانات المدخلة غير صالحة." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    return { formError: "الإيميل أو كلمة المرور غلط." };
  }

  redirect(parsed.data.next && parsed.data.next.startsWith("/") ? parsed.data.next : "/");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
