import Link from "next/link";
import { requireCurrentUser } from "@/lib/session";
import ChangePasswordForm from "./ChangePasswordForm";

export const dynamic = "force-dynamic";

export default async function ChangePasswordPage() {
  await requireCurrentUser();

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold text-foreground">كلمة السر</h1>
        <div className="flex gap-3">
          <Link href="/account/mfa" className="text-sm text-primary hover:underline">
            التحقق بخطوتين ←
          </Link>
          <Link href="/account/sessions" className="text-sm text-primary hover:underline">
            الجلسات والأجهزة ←
          </Link>
        </div>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        غيّر كلمة سر حسابك — محتاج تدخل كلمة السر الحالية الأول للتأكيد.
      </p>

      <div className="mt-6">
        <ChangePasswordForm />
      </div>
    </main>
  );
}
