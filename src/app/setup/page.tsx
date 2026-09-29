import Link from "next/link";
import { requireCurrentUser } from "@/lib/session";
import { getScopedPrisma } from "@/lib/scoped-prisma";
import { getReadiness, type ReadinessItem } from "@/lib/readiness";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

function Row({ item, index }: { item: ReadinessItem; index: number }) {
  return (
    <li
      className={cn(
        "flex flex-wrap items-start gap-3 rounded-xl border px-4 py-3",
        item.done ? "border-border bg-card" : item.severity === "blocking" ? "border-amber-300 bg-amber-50" : "border-border bg-card"
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
          item.done ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"
        )}
        aria-hidden
      >
        {item.done ? "✓" : index}
      </span>
      <div className="min-w-0 flex-1">
        <p className={cn("text-sm", item.done ? "text-muted-foreground line-through decoration-muted-foreground/40" : "font-medium text-foreground")}>
          {item.label}
          {item.severity === "optional" && !item.done && <span className="ms-2 text-[11px] text-muted-foreground">(مُستحسَن مش إلزامي)</span>}
        </p>
        {!item.done && <p className="mt-0.5 text-xs text-muted-foreground">{item.blocks}</p>}
      </div>
      {!item.done && (
        <Link
          href={item.href}
          className="shrink-0 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
        >
          {item.actionLabel} ←
        </Link>
      )}
    </li>
  );
}

export default async function SetupPage() {
  const user = await requireCurrentUser();
  const prisma = await getScopedPrisma();
  const readiness = await getReadiness(prisma, user.orgId);

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-2xl font-semibold text-foreground">تجهيز السيستم للتشغيل</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        الخطوات دي بتتفحص من قاعدة البيانات فعليًا — مش قائمة بتدوس عليها. أول ما تظبّط الناقص، بتتعلّم لوحدها.
      </p>

      {readiness.isReady ? (
        <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4">
          <p className="font-medium text-emerald-900">✓ السيستم جاهز للتشغيل</p>
          <p className="mt-1 text-sm text-emerald-800">
            تقدر تبدأ دورة كاملة: منتج ← فرصة ← عرض سعر ← صفقة ← أمر بيع ← فاتورة ببنودها ← إصدار ← تحصيل.
          </p>
        </div>
      ) : (
        <div className="mt-6 rounded-xl border border-amber-300 bg-amber-50 px-4 py-4">
          <p className="font-medium text-amber-900">
            فاضل {readiness.blockingRemaining} {readiness.blockingRemaining === 1 ? "خطوة" : "خطوات"} قبل ما تقدر تصدر أول فاتورة
          </p>
          <p className="mt-1 text-sm text-amber-800">
            القيود دي مفروضة على مستوى قاعدة البيانات مش الواجهة — يعني مش هينفع تتخطّاها. أحسن تظبّطها دلوقتي بدل ما
            توقفك وانت في نص إصدار فاتورة لعميل.
          </p>
        </div>
      )}

      <ol className="mt-5 flex flex-col gap-2">
        {readiness.items.map((item, i) => (
          <Row key={item.id} item={item} index={i + 1} />
        ))}
      </ol>

      <div className="mt-6 rounded-xl border border-border bg-card px-4 py-3">
        <p className="text-sm font-medium text-foreground">حاجة كمان مش بيتفحصها السيستم</p>
        <p className="mt-1 text-xs text-muted-foreground">
          فاتورة المبيعات مش هتتصدر من غير مستند إلكتروني معتمد من مصلحة الضرائب (ETA) مربوط بيها — قيد قانوني مصري
          بغرامة توصل ٢٠ ألف جنيه. المستند بيتربط من صفحة الفاتورة نفسها بعد اعتماده.
        </p>
      </div>
    </main>
  );
}
