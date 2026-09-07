import Link from "next/link";
import { requireCurrentUser } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { listMySessions, decodeSessionId } from "@/lib/authSessions";
import RevokeSessionButton from "./RevokeSessionButton";

export const dynamic = "force-dynamic";

export default async function SessionsPage() {
  const user = await requireCurrentUser();

  // ⚠️ getSession() هنا بقصد — استثناء ضيّق من قاعدة "استخدم getUser()" في src/lib/supabase/server.ts.
  // requireCurrentUser() فوق أصلًا اتحقّق من الهوية عبر getUser() الحقيقي؛ getSession() هنا
  // مستخدمة بس عشان نقرأ claim اسمه session_id من الـaccess token لتمييز "الجهاز ده" في
  // العرض — مش قرار صلاحية أو هوية. ممنوع تتاخد كسابقة لاستخدام getSession() في أي قرار مصادقة.
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const currentSessionId = session ? decodeSessionId(session.access_token) : null;

  const sessions = await listMySessions(user.id);

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <div className="flex gap-3">
        <Link href="/account/mfa" className="text-sm text-muted-foreground hover:underline">
          → التحقق بخطوتين (MFA)
        </Link>
        <Link href="/account/password" className="text-sm text-muted-foreground hover:underline">
          → كلمة السر
        </Link>
      </div>

      <h1 className="mt-3 text-2xl font-semibold text-foreground">الجلسات والأجهزة</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        الأجهزة اللي مسجّل دخول منها بحسابك حاليًا. إلغاء جلسة بيسجّل خروج من الجهاز ده — بيتفعّل
        مع أول طلب تاني منه، مش فوري 100% لو الجهاز أوفلاين وقت الإلغاء.
      </p>

      <div className="mt-6 flex flex-col gap-3">
        {sessions.length === 0 ? (
          <p className="text-sm text-muted-foreground">لا يوجد جلسات نشطة.</p>
        ) : (
          sessions.map((s) => {
            const isCurrent = s.id === currentSessionId;
            return (
              <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4">
                <div>
                  <p className="text-sm text-foreground">
                    {s.userAgent ?? "جهاز غير معروف"}
                    {isCurrent && <span className="ms-2 rounded bg-emerald-100 px-1.5 py-0.5 text-xs text-emerald-700">الجلسة الحالية</span>}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {s.ip && `${s.ip} · `}
                    آخر نشاط {new Intl.DateTimeFormat("ar-EG", { dateStyle: "medium", timeStyle: "short" }).format(s.updatedAt)}
                    {s.notAfter && ` · تنتهي تلقائيًا ${new Intl.DateTimeFormat("ar-EG", { dateStyle: "medium", timeStyle: "short" }).format(s.notAfter)}`}
                  </p>
                </div>
                {!isCurrent && <RevokeSessionButton sessionId={s.id} />}
              </div>
            );
          })
        )}
      </div>
    </main>
  );
}
