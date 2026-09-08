"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

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
  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    return { formError: "الإيميل أو كلمة المرور غلط." };
  }

  // isActive بيتفحص هنا صراحة — الحساب المعطَّل يقدر يوثّق نفسه بنجاح عند Supabase (كلمة السر
  // صح)، بس ده مش كافي وحده. requireCurrentUser() بيفحصها كمان لصفحات/أفعال تانية، لكن ده مش
  // بديل عن فحصها هنا — أي مسار (زي الصفحات اللي بتقرا من getScopedPrisma() مباشرة بلا
  // requireCurrentUser()) لازم يفضل معطّل من نقطة الدخول نفسها، مش بس بعدها (اتكشف بمراجعة كود،
  // 8 سبتمبر). لو الحساب معطَّل، بنسجّل خروج فورًا عشان مانسيبش جلسة صالحة قائمة.
  if (data.user) {
    const dbUser = await prisma.user.findUnique({ where: { id: data.user.id }, select: { isActive: true } });
    if (dbUser && !dbUser.isActive) {
      await supabase.auth.signOut();
      return { formError: "الحساب ده معطّل — كلّم مدير النظام." };
    }
  }

  redirect(parsed.data.next && parsed.data.next.startsWith("/") ? parsed.data.next : "/");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
