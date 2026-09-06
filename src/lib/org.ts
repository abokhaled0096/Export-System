import { requireCurrentUser } from "./session";

/**
 * orgId المستخدم الحالي فعليًا — مش "أول صف Organization" زي ما كان قبل تفعيل
 * Auth (25 أغسطس). صف Organization لسه واحد بس (قرار multi-tenancy)، لكن دلوقتي
 * بييجي عبر جلسة Supabase الحقيقية للمستخدم، مش افتراض أعمى.
 *
 * ⚠️ ده لسه مش بديل عن RLS على مستوى القاعدة — الاتصال بيتم بدور `postgres` اللي
 * بيتخطى أي Policy. الفلترة دي حماية على مستوى التطبيق بس لحد ما تُبنى طبقة
 * SET LOCAL ROLE / JWT claims عبر Prisma Client Extension (راجع STATUS.md).
 */
export async function getCurrentOrgId(): Promise<string> {
  const user = await requireCurrentUser();
  return user.orgId;
}
