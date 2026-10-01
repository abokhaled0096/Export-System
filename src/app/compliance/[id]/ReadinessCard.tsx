import { Badge } from "@/components/ui/badge";
import { readinessBand, type ReadinessResult } from "@/lib/complianceScoring";

const TONE_STYLE: Record<string, string> = {
  ready: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  minor: "bg-sky-100 text-sky-700 hover:bg-sky-100",
  actions: "bg-amber-100 text-amber-800 hover:bg-amber-100",
  notReady: "bg-orange-100 text-orange-800 hover:bg-orange-100",
  blocked: "bg-rose-100 text-rose-700 hover:bg-rose-100",
};

/**
 * بطاقة جاهزية الامتثال — مواصفة مشروع ٥ §٢٤.
 *
 * ⚠️ **الحواجز معروضة فوق الرقم عن قصد، مش تحته.**
 *
 * المواصفة بتقول صراحة: «لا يمكن أن تعوّض الدرجة: منتج محظور، شهادة إلزامية منتهية،
 * نتيجة تحليل Fail...». ملف درجته 95 ومعاه شهادة منتهية **مش جاهز** — ولو الحواجز
 * اتعرضت تحت الرقم، اللي هيفضل في دماغ المستخدم هو الـ95.
 *
 * الدرجة بتوصف **التقدّم**، الحواجز بتحدّد **الإذن**. حاجتين مختلفتين، والعرض لازم
 * يعكس ده.
 */
export default function ReadinessCard({ result }: { result: ReadinessResult }) {
  const band = result.totalScore === null ? null : readinessBand(result.totalScore);

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      {result.blockers.length > 0 && (
        <div role="alert" className="mb-3 rounded-lg border border-rose-300 bg-rose-50 p-3 text-sm text-rose-900">
          <p className="font-medium">
            ⛔ {result.blockers.length} حاجز بيمنع الشحن — الدرجة مابتعوّضهمش
          </p>
          <ul className="mt-1.5 list-inside list-disc space-y-0.5 text-xs">
            {result.blockers.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap items-baseline gap-3">
        <h3 className="text-sm font-medium text-foreground">مؤشر الجاهزية</h3>
        {result.totalScore === null ? (
          <span className="text-sm text-muted-foreground">غير قابل للحساب — مفيش ولا مكوّن له بيانات.</span>
        ) : (
          <>
            <span className="font-mono text-2xl font-semibold text-foreground">{result.totalScore}</span>
            <span className="text-sm text-muted-foreground">/ 100</span>
            {band && <Badge className={TONE_STYLE[band.tone]}>{band.label}</Badge>}
            <span className={`text-xs ${result.coveragePct < 70 ? "text-amber-700" : "text-muted-foreground"}`}>
              محسوب على {result.coveragePct}% من الأوزان
            </span>
          </>
        )}
      </div>

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
    </div>
  );
}
