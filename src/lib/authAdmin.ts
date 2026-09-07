import { createClient } from "@supabase/supabase-js";

/** ⚠️ سيرفر بس — service_role key بيتخطّى RLS بالكامل، ممنوع يتلمس من Client Component.
 * نفس نمط src/lib/storage.ts بالحرف. */
function getAuthAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_SERVICE_ROLE_KEY مش متظبط — راجع .env.");
  return createClient(url, key, { auth: { persistSession: false } });
}

/** بينشئ حساب Supabase Auth جديد بكلمة سر يحدّدها الأدمن — email_confirm: true لأن الأدمن نفسه
 * بيوثّق الإيميل مباشرة، بلا اعتماد على إرسال إيميل تحقق فعلي (SMTP). بيحل محل الخطوة اليدوية
 * "Dashboard → Authentication → Add User" (راجع prisma/link-auth-user.ts). */
export async function createAuthUser(email: string, password: string): Promise<{ id: string }> {
  const supabase = getAuthAdminClient();
  const { data, error } = await supabase.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw new Error(`فشل إنشاء حساب المصادقة: ${error?.message ?? "unknown"}`);
  return { id: data.user.id };
}

/** إعادة تعيين كلمة سر مستخدم موجود — الأدمن بيحدّد القيمة الجديدة، مفيش قراءة للقيمة القديمة
 * (كلمات السر مشفّرة اتجاه واحد، مفيش نظام يقدر "يشوفها"). */
export async function updateAuthUserPassword(authUserId: string, password: string): Promise<void> {
  const supabase = getAuthAdminClient();
  const { error } = await supabase.auth.admin.updateUserById(authUserId, { password });
  if (error) throw new Error(`فشل تحديث كلمة السر: ${error.message}`);
}

/** للـrollback لو نجح إنشاء حساب Supabase Auth لكن فشل إنشاء صف public.User المرتبط بيه بعد كده
 * — best-effort، بلا throw لو الحذف نفسه فشل (الخطأ الأصلي هو اللي المستخدم لازم يشوفه). */
export async function deleteAuthUser(authUserId: string): Promise<void> {
  const supabase = getAuthAdminClient();
  await supabase.auth.admin.deleteUser(authUserId).catch(() => {});
}
