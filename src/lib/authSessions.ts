import { prisma } from "./prisma";

export type AuthSessionRow = {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  notAfter: Date | null;
  userAgent: string | null;
  ip: string | null;
};

/**
 * ⚠️ بيقرأ/بيكتب في `auth.sessions`/`auth.refresh_tokens` مباشرة — جداول داخلية في Supabase Auth،
 * مش موديل في `prisma/schema.prisma` ولا API رسمي موثّق (زي `auth.admin.*`). ممكن يتغيّر شكلها في
 * ترقية مستقبلية لـSupabase (راجع BACKLOG.md). النطاق هنا self-service بس — كل استعلام
 * بيتشرط بـuserId، مفيش لوحة إدارة عبر المستخدمين كلهم.
 */

const MAX_SESSIONS_LISTED = 50;

/** جلسات المستخدم الحالي بس، الأحدث نشاطًا الأول. سقف دفاعي (`LIMIT`) — نفس فلسفة
 * `MAX_STATEMENT_IMPORT_ROWS`/`DISPLAY_CAP` في باقي المشروع، مش متوقّع حساب عنده مئات
 * الجلسات فعليًا، بس الصفحة دي بلا pagination فمينفعش تفضل من غير سقف. */
export async function listMySessions(userId: string): Promise<AuthSessionRow[]> {
  return prisma.$queryRaw<AuthSessionRow[]>`
    SELECT id, created_at AS "createdAt", updated_at AS "updatedAt", not_after AS "notAfter",
           user_agent AS "userAgent", host(ip) AS ip
    FROM auth.sessions
    WHERE user_id = ${userId}::uuid
    ORDER BY updated_at DESC
    LIMIT ${MAX_SESSIONS_LISTED}
  `;
}

/** إلغاء جلسة واحدة — الشرط بـuserId كمان (مش sessionId بس) يمنع مستخدم من مسح جلسة حد تاني
 * حتى لو خمّن الـid. `auth.refresh_tokens.session_id` عليه `ON DELETE CASCADE` بالفعل (اتأكّد
 * وقت البناء)، فمفيش داعي نمسحه يدوي. */
export async function revokeMySession(userId: string, sessionId: string): Promise<void> {
  await prisma.$executeRaw`
    DELETE FROM auth.sessions WHERE id = ${sessionId}::uuid AND user_id = ${userId}::uuid
  `;
}

/** استخراج `session_id` من access token (JWT) بلا مكتبة خارجية ولا تحقق توقيع — التوكن هنا
 * جاي من `getSession()` بعد ما المستخدم اتأكّد فعليًا عبر `getUser()` في `requireCurrentUser()`
 * أصلًا، والاستخدام الوحيد تمييز "الجهاز ده" في العرض، مش قرار صلاحية. */
export function decodeSessionId(accessToken: string): string | null {
  try {
    const payload = accessToken.split(".")[1];
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return typeof claims.session_id === "string" ? claims.session_id : null;
  } catch {
    return null;
  }
}
