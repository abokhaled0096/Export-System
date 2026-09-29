import LoginForm from "./LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="flex flex-col items-center gap-8 w-full">
        <div className="text-center">
          <h1 className="text-2xl font-semibold tracking-wide text-[var(--brand-dark)]">ELHEIBALAND EXPORT</h1>
          <p className="mt-1 text-[11px] uppercase tracking-[0.2em] text-[var(--brand-soft)]">Export &amp; International Trade</p>
          <p className="mt-4 text-sm text-neutral-500">سجّل الدخول للمتابعة</p>
        </div>
        {error === "unlinked" && (
          <p className="w-full max-w-sm rounded-lg bg-amber-50 px-3 py-2 text-center text-sm text-amber-800">
            جلستك انتهت — سجّل دخول تاني، أي بيانات كنت بتكتبها في فورم طويل هترجع تلقائيًا.
          </p>
        )}
        {error === "deactivated" && (
          <p className="w-full max-w-sm rounded-lg bg-rose-50 px-3 py-2 text-center text-sm text-rose-800">
            الحساب ده معطّل — كلّم مدير النظام.
          </p>
        )}
        <LoginForm next={next} />
      </div>
    </main>
  );
}
