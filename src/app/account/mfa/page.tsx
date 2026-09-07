import Link from "next/link";
import { requireCurrentUser } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import EnrollmentFlow from "./EnrollmentFlow";
import UnenrollButton from "./UnenrollButton";

export const dynamic = "force-dynamic";

export default async function MfaSettingsPage() {
  await requireCurrentUser();
  const supabase = await createClient();
  const { data: factors } = await supabase.auth.mfa.listFactors();
  const verified = factors?.totp.filter((f) => f.status === "verified") ?? [];

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold text-neutral-900">التحقق بخطوتين (MFA)</h1>
        <div className="flex gap-3">
          <Link href="/account/password" className="text-sm text-primary hover:underline">
            كلمة السر ←
          </Link>
          <Link href="/account/sessions" className="text-sm text-primary hover:underline">
            الجلسات والأجهزة ←
          </Link>
        </div>
      </div>
      <p className="mt-1 text-sm text-neutral-500">
        مطلوب قبل أي عملية حساسة (اعتماد/رفض موافقة استثنائية على تجاوز السعر الأدنى) — راجع
        CLAUDE.md §قواعد الأمان.
      </p>

      {verified.length > 0 ? (
        <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-sm font-medium text-emerald-800">✓ التحقق بخطوتين مفعّل</p>
          <div className="mt-3 flex flex-col gap-2">
            {verified.map((f) => (
              <div key={f.id} className="flex items-center justify-between">
                <span className="text-sm text-neutral-700">{f.friendly_name ?? "تطبيق المصادقة"}</span>
                <UnenrollButton factorId={f.id} />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-6">
          <EnrollmentFlow />
        </div>
      )}
    </main>
  );
}
