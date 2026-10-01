import { Badge } from "@/components/ui/badge";
import { formatNumber, formatDate } from "@/lib/format";
import { DEVIATION_REASON_LABEL, type DealActualResult } from "@/lib/dealActual";

type Row = { label: string; planned: string; actual: string; variance: number | null; invertTone?: boolean };

/** فرق موجب في التكلفة سيّئ، وفي الربح كويس — `invertTone` بيقلب اللون. */
function varianceTone(variance: number | null, invert: boolean): string {
  if (variance === null || variance === 0) return "text-muted-foreground";
  const good = invert ? variance > 0 : variance < 0;
  return good ? "text-emerald-700" : "text-rose-700";
}

function sign(v: number | null, digits = 2): string {
  if (v === null) return "—";
  return `${v > 0 ? "+" : ""}${formatNumber(v, digits)}`;
}

/**
 * بطاقة «مخطط مقابل فعلي» — مواصفة مشروع ٢ §٢٧.
 *
 * ⚠️ **الخانة الفاضية بتتعرض «—» مش صفر.** الفرق بين «ماتسجّلش» و«اتسجّل وطلع صفر»
 * بيغيّر قرار إداري: الأولى معناها البيانات ناقصة، والتانية معناها مفيش تكلفة فعلًا.
 */
export default function DealActualCard({
  result,
  planned,
  currency,
  deviations,
  collectedAt,
  needsExplanation,
}: {
  result: DealActualResult;
  planned: { cost: number | null; profit: number | null; marginPct: number | null };
  currency: string;
  deviations: { reason: string; impactAmount: { toString(): string } | null; note: string | null }[];
  collectedAt: Date | null;
  needsExplanation: boolean;
}) {
  const rows: Row[] = [
    {
      label: "إجمالي التكلفة",
      planned: planned.cost === null ? "—" : formatNumber(planned.cost),
      actual: result.actualFullCost === null ? "—" : formatNumber(result.actualFullCost),
      variance: result.costVariance,
    },
    {
      label: "الربح",
      planned: planned.profit === null ? "—" : formatNumber(planned.profit),
      actual: result.actualProfit === null ? "—" : formatNumber(result.actualProfit),
      variance: result.profitVariance,
      invertTone: true,
    },
    {
      label: "الهامش %",
      planned: planned.marginPct === null ? "—" : `${formatNumber(planned.marginPct)}%`,
      actual: result.actualMarginPct === null ? "—" : `${formatNumber(result.actualMarginPct)}%`,
      variance: result.marginVariancePct,
      invertTone: true,
    },
  ];

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-baseline gap-3">
        <h3 className="text-sm font-medium text-foreground">النتيجة الفعلية مقابل المخطط</h3>
        {result.pricingAccuracyPct !== null && (
          <Badge
            className={
              result.pricingAccuracyPct >= 90
                ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100"
                : result.pricingAccuracyPct >= 70
                  ? "bg-amber-100 text-amber-800 hover:bg-amber-100"
                  : "bg-rose-100 text-rose-700 hover:bg-rose-100"
            }
          >
            دقة التسعير {formatNumber(result.pricingAccuracyPct, 0)}%
          </Badge>
        )}
      </div>

      {result.warnings.length > 0 && (
        <ul role="alert" className="mt-2 list-inside list-disc rounded-lg border border-amber-300 bg-amber-50 p-2.5 text-xs text-amber-900">
          {result.warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}

      <table className="mt-3 w-full text-sm">
        <thead>
          <tr className="text-xs text-muted-foreground">
            <th className="pb-1 text-start font-normal">البند</th>
            <th className="pb-1 text-start font-normal">مخطط</th>
            <th className="pb-1 text-start font-normal">فعلي</th>
            <th className="pb-1 text-start font-normal">الفرق</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label}>
              <td className="py-1 pe-2 text-foreground/80">{r.label}</td>
              <td className="py-1 pe-2 font-mono text-foreground/70">{r.planned}</td>
              <td className="py-1 pe-2 font-mono text-foreground">{r.actual}</td>
              <td className={`py-1 font-mono ${varianceTone(r.variance, r.invertTone ?? false)}`}>
                {sign(r.variance, r.label === "الهامش %" ? 1 : 2)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-3 grid grid-cols-2 gap-3 border-t border-border pt-3 text-xs sm:grid-cols-4">
        <div>
          <p className="text-muted-foreground">تكلفة الكيلو</p>
          <p className="mt-0.5 font-mono text-foreground">
            {result.actualCostPerKg === null ? "—" : `${formatNumber(result.actualCostPerKg, 4)} ${currency}`}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground">العائد الفعلي</p>
          <p className="mt-0.5 font-mono text-foreground">
            {result.actualYieldPct === null ? "—" : `${formatNumber(result.actualYieldPct, 1)}%`}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground">الماركاپ الفعلي</p>
          <p className="mt-0.5 font-mono text-foreground">
            {result.actualMarkupPct === null ? "—" : `${formatNumber(result.actualMarkupPct, 1)}%`}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground">دورة النقد</p>
          <p className="mt-0.5 font-mono text-foreground">
            {result.actualCashCycleDays === null ? "—" : `${result.actualCashCycleDays} يوم`}
            {collectedAt ? <span className="ms-1 text-muted-foreground">({formatDate(collectedAt)})</span> : null}
          </p>
        </div>
      </div>

      {/* ⚠️ الانحراف الجوهري بلا سبب مسجَّل = نتيجة ناقصة. التنبيه ظاهر مش مخفي،
          لأن السبب هو اللي بيخلّي الرقم مفيد في التسعير الجاي — من غيره الرقم
          بيقول «خسرنا» بلا «ليه». */}
      {needsExplanation && deviations.length === 0 && (
        <p role="alert" className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-2.5 text-xs text-amber-900">
          الانحراف تعدّى 10% ومفيش سبب مسجَّل — سجّل السبب تحت، عشان الرقم ده يفيد في تسعير الصفقة الجاية.
        </p>
      )}

      {deviations.length > 0 && (
        <div className="mt-3 border-t border-border pt-3">
          <p className="text-xs text-muted-foreground">أسباب الانحراف</p>
          <ul className="mt-1.5 space-y-1 text-xs">
            {deviations.map((d) => (
              <li key={d.reason} className="flex flex-wrap items-baseline gap-2">
                <Badge className="bg-secondary text-secondary-foreground hover:bg-secondary">
                  {DEVIATION_REASON_LABEL[d.reason] ?? d.reason}
                </Badge>
                {d.impactAmount !== null && (
                  <span className="font-mono text-foreground/80">
                    {sign(Number(d.impactAmount.toString()))} {currency}
                  </span>
                )}
                {d.note && <span className="text-muted-foreground">{d.note}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
