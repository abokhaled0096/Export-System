import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/supabase/server";

/**
 * المستخدم الحالي مربوط بالـpublic.User (orgId + role) — id الصف هو نفسه
 * auth.users.id بتاع Supabase (ERD v3، ملاحظة User.id في prisma/schema.prisma).
 * لو مفيش صف User مطابق (حساب اتعمل في Supabase بس محدش رَبَطه لسه)، بيرجّع null —
 * راجع prisma/link-auth-user.ts للربط الأولاني.
 *
 * ⚠️ self-healing لسيناريو شائع وقت التطوير: لو الحساب في Supabase Auth اتمسح واتعمل
 * تاني بنفس الإيميل (نفس اليوزر بس UUID جديد)، صف User القديم بيفضل مربوط بالـid القديم
 * ويبقى "orphaned". بدل ما نوقّف المستخدم عند شاشة "غير مربوط" ونحتاج سكريبت يدوي كل مرة،
 * لو لقينا صف قديم بنفس الإيميل بـid مختلف، بنحدّث الـid بس (كل الـFKs بتاعت User عليها
 * ON UPDATE CASCADE — راجع migrations — فمفيش بيانات بتتفقد). آمن لأن الإيميل من
 * Supabase Auth نفسه (getAuthenticatedUser بينادي getUser() اللي بيتحقق مع السيرفر)، مش
 * مدخل مستخدم خام.
 */
export async function getCurrentUser() {
  const authUser = await getAuthenticatedUser();
  if (!authUser) return null;

  const user = await prisma.user.findUnique({ where: { id: authUser.id }, include: { role: true } });
  if (user) return user;

  if (!authUser.email) return null;
  const orphaned = await prisma.user.findUnique({ where: { email: authUser.email } });
  if (!orphaned) return null;

  console.warn(
    `[session] إعادة ربط User.id تلقائيًا (حساب Supabase Auth اتعمل من جديد): ${authUser.email} ${orphaned.id} → ${authUser.id}`
  );
  return prisma.user.update({
    where: { id: orphaned.id },
    data: { id: authUser.id },
    include: { role: true },
  });
}

/**
 * بيرمي لصفحة "الحساب غير مربوط" بدل ما يفترض أول Organization — راجع getCurrentUser أعلاه.
 * بيحاول يحطّ `next` بالصفحة اللي المستخدم كان عليها (من `referer`، لأن أي Server Action بتتبعت
 * كـPOST للصفحة الحالية نفسها) — عشان بعد ما يسجّل دخول تاني يرجع لمكانه، مش يبدأ من لوحة القيادة
 * من غير أي فايدة. لو الجلسة انتهت وسط فورم طويل، `useFormDraft` (راجع src/lib/useFormDraft.ts)
 * بيحفظ اللي كان بيكتبه محليًا في المتصفح فيرجعله لما يوصل نفس الصفحة تاني — الاتنين مع بعض
 * بيقفلوا فقدان البيانات الصامت. راجع BACKLOG.md § فقدان بيانات صامت.
 */
export async function requireCurrentUser() {
  const user = await getCurrentUser();
  if (!user || !user.isActive) {
    const referer = (await headers()).get("referer");
    let next: string | null = null;
    if (referer) {
      try {
        const path = new URL(referer).pathname;
        if (path.startsWith("/") && !path.startsWith("/login")) next = path;
      } catch {
        // referer مش URL صالح (نادر) — نتجاهل ونرمي بلا next.
      }
    }
    const error = user ? "deactivated" : "unlinked";
    redirect(next ? `/login?error=${error}&next=${encodeURIComponent(next)}` : `/login?error=${error}`);
  }
  return user;
}
