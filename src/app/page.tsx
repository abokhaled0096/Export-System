import Link from "next/link";
import { getScopedPrisma } from "@/lib/scoped-prisma";
import { getCurrentOrgId } from "@/lib/org";
import { getDashboardData, type ActionItem } from "@/lib/dashboard";
import { getReadiness } from "@/lib/readiness";
import { RevenueChart, StageChart } from "@/components/DashboardCharts";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

// بيانات حية لكل طلب — منع الـPrerendering الثابت وقت البناء (راجع build output).
export const dynamic = "force-dynamic";

const toneStyles: Record<ActionItem["tone"], string> = {
  danger: "border-rose-300 bg-rose-50 text-rose-900 hover:border-rose-400",
  warning: "border-amber-300 bg-amber-50 text-amber-900 hover:border-amber-400",
  neutral: "border-border bg-card text-foreground hover:border-primary/40",
};

function ActionCard({ item }: { item: ActionItem }) {
  return (
    <Link
      href={item.href}
      className={cn("flex items-center gap-3 rounded-xl border px-4 py-3 transition-colors", toneStyles[item.tone])}
    >
      <span className="font-mono text-2xl font-semibold">{item.count}</span>
      <span className="text-sm leading-tight">{item.label}</span>
    </Link>
  );
}

function Kpi({ label, value, hint, href, tone }: { label: string; value: string; hint?: string; href: string; tone?: "danger" }) {
  return (
    <Link
      href={href}
      className="flex flex-col gap-1 rounded-xl border border-border bg-card px-5 py-4 transition-colors hover:border-primary/40"
    >
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={cn("font-mono text-xl font-semibold", tone === "danger" ? "text-rose-700" : "text-foreground")}>
        {value}
      </span>
      {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
    </Link>
  );
}

export default async function Home() {
  const orgId = await getCurrentOrgId();
  const prisma = await getScopedPrisma();
  // ⚠️ مش Promise.all — راجع BACKLOG.md (P2028).
  const readiness = await getReadiness(prisma, orgId);
  const d = await getDashboardData(prisma, orgId);

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="text-2xl font-semibold text-foreground">لوحة القيادة</h1>
      <p className="mt-1 text-sm text-muted-foreground">نظرة سريعة على نشاط الشركة الحالي.</p>

      {/* التجهيز فوق كل حاجة، وبيختفي خالص لما يخلص. من غير ده المستخدم بيكتشف الناقص وهو
          بيحاول يصدر فاتورة لعميل — أسوأ وقت ممكن. */}
      {!readiness.isReady && (
        <Link
          href="/setup"
          className="mt-5 flex flex-wrap items-center gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 transition-colors hover:border-amber-400"
        >
          <span className="font-mono text-2xl font-semibold text-amber-900">{readiness.blockingRemaining}</span>
          <span className="flex-1 text-sm leading-tight text-amber-900">
            {readiness.blockingRemaining === 1 ? "خطوة ناقصة" : "خطوات ناقصة"} قبل ما تقدر تصدر أول فاتورة
            <span className="mt-0.5 block text-xs text-amber-800/80">
              {readiness.items.filter((i) => i.severity === "blocking" && !i.done).map((i) => i.label).join(" · ")}
            </span>
          </span>
          <span className="text-sm font-medium text-amber-900">ابدأ التجهيز ←</span>
        </Link>
      )}

      {/* 1) محتاج قرارك — أول حاجة تتشاف، وبتختفي خالص لو مفيش حاجة مستنّية. */}
      {d.actions.length > 0 ? (
        <section className="mt-6">
          <h2 className="text-sm font-medium text-foreground">محتاج قرارك</h2>
          <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {d.actions.map((a) => (
              <ActionCard key={a.href} item={a} />
            ))}
          </div>
        </section>
      ) : (
        <p className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          ✓ مفيش حاجة مستنّية قرارك دلوقتي.
        </p>
      )}

      {/* 2) الفلوس */}
      <section className="mt-8">
        <h2 className="text-sm font-medium text-foreground">الوضع المالي</h2>
        <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi label="مبيعات الشهر" value={formatMoney(d.revenueThisMonth, d.currency)} href="/accounting/income-statement" />
          <Kpi
            label="صافي الربح من أول السنة"
            value={formatMoney(d.netProfitYtd, d.currency)}
            href="/accounting/income-statement"
            tone={d.netProfitYtd.isNegative() ? "danger" : undefined}
          />
          <Kpi
            label="مستحق على العملاء"
            value={formatMoney(d.outstandingReceivables, d.currency)}
            hint="المتبقي على الفواتير المُصدَرة"
            href="/accounting/receivables"
          />
          <Kpi
            label="منه متأخر"
            value={formatMoney(d.overdueReceivables, d.currency)}
            hint="فات موعد استحقاقه"
            href="/accounting/receivables"
            tone={d.overdueReceivables.greaterThan(0) ? "danger" : undefined}
          />
        </div>
      </section>

      {/* 3) الاتجاه */}
      <section className="mt-8 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-medium text-foreground">الإيراد — آخر ٦ شهور</h2>
          <p className="mb-2 text-[11px] text-muted-foreground">بالعملة الوظيفية ({d.currency}) · من القيود المرحّلة</p>
          <RevenueChart data={d.monthlyRevenue} currency={d.currency} />
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-medium text-foreground">الفرص حسب المرحلة</h2>
          <p className="mb-2 text-[11px] text-muted-foreground">خط الأنابيب الحالي</p>
          <StageChart data={d.dealsByStage} />
        </div>
      </section>

      {!d.hasAnyData && (
        <p className="mt-6 text-xs text-muted-foreground">
          اللوحة لسه فاضية لأن مفيش قيود مرحّلة ولا فرص مسجّلة. هتتملّى تلقائيًا أول ما تبدأ تشتغل على السيستم.
        </p>
      )}
    </main>
  );
}
