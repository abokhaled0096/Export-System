import { redirect } from "next/navigation";
import { requireCurrentUser } from "@/lib/session";
import { getAal } from "@/lib/mfa";
import ChallengeForm from "./ChallengeForm";

export const dynamic = "force-dynamic";

export default async function MfaChallengePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  await requireCurrentUser();
  const { next } = await searchParams;
  const target = next && next.startsWith("/") ? next : "/";

  const level = await getAal();
  if (level === "aal2") redirect(target);

  return (
    <main className="mx-auto max-w-md px-6 py-10">
      <h1 className="text-2xl font-semibold text-neutral-900">تأكيد الهوية مطلوب</h1>
      <p className="mt-1 text-sm text-neutral-500">
        العملية دي حساسة ومحتاجة تحقق بخطوتين — أدخل الكود من تطبيق المصادقة.
      </p>
      <ChallengeForm next={target} />
    </main>
  );
}
