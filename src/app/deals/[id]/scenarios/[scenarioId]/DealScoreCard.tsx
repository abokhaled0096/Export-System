import { Badge } from "@/components/ui/badge";
import { dealScoreBand, type DealScoreResult } from "@/lib/dealScoring";

const TONE_STYLE: Record<string, string> = {
  good: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  watch: "bg-sky-100 text-sky-700 hover:bg-sky-100",
  negotiate: "bg-amber-100 text-amber-800 hover:bg-amber-100",
  risk: "bg-rose-100 text-rose-700 hover:bg-rose-100",
};

/**
 * بطاقة درجة الصفقة — مواصفة مشروع ٢ §٢٥.
 *
 * ⚠️ **التغطية بتتعرض جنب الدرجة دايمًا، مش في تفصيل مطوي.** درجة 80 محسوبة على
 * 60% من الأوزان مش نفس درجة 80 محسوبة على 100% — وإخفاء الفرق ده بيحوّل الرقم
 * من مؤشر لطمأنينة كاذبة. نفس سبب وجود `componentsBreakdown` في `ScoreSnapshot`.
 *
 * والمكوّنات اللي مالهاش بيانات بتتعرض **بسببها** مش بتتشال من القايمة — عشان
 * المستخدم يعرف إيه اللي لو سجّله الدرجة هتبقى أدق.
 */
export default function DealScoreCard({ result }: { result: DealScoreResult }) {
  const band = result.totalScore === null ? null : dealScoreBand(result.totalScore);
  const missing = result.components.filter((c) => c.score === null);

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-baseline gap-3">
        <h3 className="text-sm font-medium text-foreground">درجة الصفقة</h3>
        {result.totalScore === null ? (
          <span className="text-sm text-muted-foreground">غير قابلة للحساب — مفيش ولا مكوّن له بيانات.</span>
        ) : (
          <>
            <span className="font-mono text-2xl font-semibold text-foreground">{result.totalScore}</span>
            <span className="text-sm text-muted-foreground">/ 100</span>
            {band && <Badge className={TONE_STYLE[band.tone]}>{band.label}</Badge>}
            <span className={`text-xs ${result.coveragePct < 70 ? "text-amber-700" : "text-muted-foreground"}`}>
              محسوبة على {result.coveragePct}% من الأوزان
            </span>
          </>
        )}
      </div>

      {result.coveragePct < 70 && result.totalScore !== null && (
        <p role="alert" className="mt-2 rounded-lg border border-amber-300 bg-amber-50 p-2.5 text-xs text-amber-900">
          التغطية أقل من 70% — الدرجة دي مؤشر أوّلي. سجّل البيانات الناقصة تحت عشان تبقى معبّرة.
        </p>
      )}

      <table className="mt-3 w-full text-xs">
        <thead>
          <tr className="text-muted-foreground">
            <th className="pb-1 text-start font-normal">المكوّن</th>
            <th className="pb-1 text-start font-normal">الوزن</th>
            <th className="pb-1 text-start font-normal">الدرجة</th>
            <th className="pb-1 text-start font-normal">السبب</th>
          </tr>
        </thead>
        <tbody>
          {result.components.map((c) => (
            <tr key={c.key} className={c.score === null ? "text-muted-foreground/70" : "text-foreground/80"}>
              <td className="py-1 pe-2">{c.label}</td>
              <td className="py-1 pe-2 font-mono">{c.weight}</td>
              <td className="py-1 pe-2 font-mono">{c.score === null ? "—" : c.score}</td>
              <td className="py-1">{c.reason}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {missing.length > 0 && (
        <p className="mt-2 text-xs text-muted-foreground">
          {missing.length} مكوّن مالهوش بيانات — اتشالوا من الوزن بدل ما يتحطّ لهم قيمة محايدة تضلّل الدرجة.
        </p>
      )}

      <p className="mt-2 text-xs text-muted-foreground">
        ⚠️ الدرجة دي <strong>مؤشر مش إذن</strong> — مابتلغيش الحد الأدنى للسعر ولا بوابات الامتثال ولا حدود
        الائتمان. دي قيود مفروضة على مستوى قاعدة البيانات مستقلة عن الدرجة تمامًا.
      </p>
    </div>
  );
}
