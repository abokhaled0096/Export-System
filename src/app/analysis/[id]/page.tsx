import Link from "next/link";
import { notFound } from "next/navigation";
import { getScopedPrisma } from "@/lib/scoped-prisma";
import { getCurrentOrgId } from "@/lib/org";
import { requireCurrentUser } from "@/lib/session";
import { requirePermission } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

const recLabel: Record<string, string> = {
  Start: "ابدأ",
  Study: "ادرس أكتر",
  Monitor: "راقب",
  Avoid: "تجنّب",
};

const recStyle: Record<string, string> = {
  Start: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  Study: "bg-sky-100 text-sky-700 hover:bg-sky-100",
  Monitor: "bg-amber-100 text-amber-700 hover:bg-amber-100",
  Avoid: "bg-rose-100 text-rose-700 hover:bg-rose-100",
};

// Claim ممكن يكون نص خام (تحاليل قديمة قبل 9 سبتمبر) أو {text, sourceRefs} (تحاليل جديدة —
// كل ادعاء لازم مرجع مصدر). الاتنين مدعومين هنا عشان التحاليل القديمة تفضل تتعرض صح.
type Claim = string | { text: string; sourceRefs: number[] };
type AiDetails = {
  marketOverview?: string;
  demandDrivers?: Claim[];
  keyRisks?: Claim[];
  regulatoryNotes?: string;
  priceEstimate?: { min: number | null; max: number | null; currency: string; sourceRefs?: number[] } | null;
  recommendedNextSteps?: string[];
  rejectedSourcesCount?: number;
};

function claimText(c: Claim): string {
  return typeof c === "string" ? c : c.text;
}
// لو النص نفسه فيه مرجع [n] مكتوب بالفعل (الموديل بيميل يحطّه جوه كل جملة، مش بس الحقول
// اللي البرومبت بيطلبها صراحة)، مفيش داعي نعرض بادج SourceRefs تاني جنبه — تكرار بصري.
function hasInlineCitation(text: string): boolean {
  return /\[\d+(?:\s*,\s*\d+)*\]/.test(text);
}
function claimRefs(c: Claim): number[] {
  if (typeof c === "string" || hasInlineCitation(c.text)) return [];
  return c.sourceRefs;
}

function SourceRefs({ refs }: { refs: number[] }) {
  if (refs.length === 0) return null;
  return <sup className="mr-1 font-mono text-[10px] text-primary">[{refs.join(",")}]</sup>;
}

export default async function AnalysisDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireCurrentUser();

  try {
    await requirePermission(user.roleId, "Analysis", "View");
  } catch {
    return (
      <main className="mx-auto max-w-3xl px-6 py-10">
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-6 text-center text-sm text-destructive">
          معندكش صلاحية الوصول للصفحة دي.
        </div>
      </main>
    );
  }

  const orgId = await getCurrentOrgId();
  const prisma = await getScopedPrisma();

  const analysis = await prisma.productMarketAnalysis.findFirst({
    where: { id, orgId },
    include: { product: true, market: true },
  });
  if (!analysis) notFound();

  const sources = Array.isArray(analysis.aiSources) ? (analysis.aiSources as { title: string; url: string; publishedDate?: string | null }[]) : [];
  const details = (analysis.aiDetails ?? null) as AiDetails | null;

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <Button nativeButton={false} variant="link" className="h-auto p-0" render={<Link href="/analysis">← رجوع لقائمة التحليلات</Link>} />

      <div className="mt-3 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-foreground">
          {analysis.product.nameAr} — {analysis.market.countryNameAr}
        </h1>
        <Badge className={analysis.source === "AI" ? "bg-violet-100 text-violet-700 hover:bg-violet-100" : "bg-secondary text-secondary-foreground hover:bg-secondary"}>
          {analysis.source === "AI" ? "🤖 تحليل ذكاء اصطناعي" : "يدوي"}
        </Badge>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">سنة {analysis.year}</p>

      <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent>
            <p className="text-xs text-muted-foreground">درجة الفرصة</p>
            <p className="mt-1 font-mono text-2xl text-foreground">{analysis.opportunityScore}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-xs text-muted-foreground">درجة المخاطرة</p>
            <p className="mt-1 font-mono text-2xl text-foreground">{analysis.riskScore}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-xs text-muted-foreground">مستوى الثقة</p>
            <p className="mt-1 font-mono text-2xl text-foreground">{analysis.confidenceLevel ?? "—"}</p>
          </CardContent>
        </Card>
      </div>

      <div className="mt-4">
        <Badge className={`px-3 py-1.5 text-sm ${recStyle[analysis.recommendation]}`}>التوصية: {recLabel[analysis.recommendation]}</Badge>
      </div>

      {analysis.source === "AI" && (
        <>
          <section className="mt-8">
            <h2 className="text-lg font-medium text-foreground">سبب التقييم</h2>
            <Card className="mt-3">
              <CardContent>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/80">{analysis.aiReasoning}</p>
              </CardContent>
            </Card>
          </section>

          {details?.marketOverview && (
            <section className="mt-6">
              <h2 className="text-lg font-medium text-foreground">نظرة عامة على السوق</h2>
              <Card className="mt-3">
                <CardContent>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/80">{details.marketOverview}</p>
                </CardContent>
              </Card>
            </section>
          )}

          {details?.demandDrivers && details.demandDrivers.length > 0 && (
            <section className="mt-6">
              <h2 className="text-lg font-medium text-foreground">محركات الطلب</h2>
              <Card className="mt-3">
                <CardContent>
                  <ul className="flex flex-col gap-1.5 text-sm text-foreground/80">
                    {details.demandDrivers.map((d, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="text-emerald-600">✓</span>
                        <span>
                          {claimText(d)}
                          <SourceRefs refs={claimRefs(d)} />
                        </span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </section>
          )}

          {details?.keyRisks && details.keyRisks.length > 0 && (
            <section className="mt-6">
              <h2 className="text-lg font-medium text-foreground">المخاطر الرئيسية</h2>
              <Card className="mt-3">
                <CardContent>
                  <ul className="flex flex-col gap-1.5 text-sm text-foreground/80">
                    {details.keyRisks.map((r, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="text-rose-600">⚠</span>
                        <span>
                          {claimText(r)}
                          <SourceRefs refs={claimRefs(r)} />
                        </span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </section>
          )}

          {details?.priceEstimate && (details.priceEstimate.min !== null || details.priceEstimate.max !== null) && (
            <section className="mt-6">
              <h2 className="text-lg font-medium text-foreground">نطاق السعر التقديري</h2>
              <Card className="mt-3">
                <CardContent>
                  <p className="font-mono text-sm text-foreground/80">
                    {details.priceEstimate.min ?? "؟"} – {details.priceEstimate.max ?? "؟"} {details.priceEstimate.currency}
                    <SourceRefs refs={details.priceEstimate.sourceRefs ?? []} />
                  </p>
                </CardContent>
              </Card>
            </section>
          )}

          {details?.regulatoryNotes && (
            <section className="mt-6">
              <h2 className="text-lg font-medium text-foreground">الالتزامات التنظيمية</h2>
              <Card className="mt-3">
                <CardContent>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/80">{details.regulatoryNotes}</p>
                </CardContent>
              </Card>
            </section>
          )}

          {details?.recommendedNextSteps && details.recommendedNextSteps.length > 0 && (
            <section className="mt-6">
              <h2 className="text-lg font-medium text-foreground">خطوات موصى بها</h2>
              <Card className="mt-3">
                <CardContent>
                  <ol className="flex flex-col gap-1.5 text-sm text-foreground/80">
                    {details.recommendedNextSteps.map((s, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="font-mono text-muted-foreground">{i + 1}.</span>
                        {s}
                      </li>
                    ))}
                  </ol>
                </CardContent>
              </Card>
            </section>
          )}

          {sources.length > 0 && (
            <section className="mt-6">
              <h2 className="text-lg font-medium text-foreground">المصادر</h2>
              <ul className="mt-3 flex flex-col gap-2">
                {sources.map((s, i) => (
                  <li key={i} className="text-sm">
                    <span className="ml-1 font-mono text-xs text-muted-foreground">[{i + 1}]</span>
                    <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                      {s.title}
                    </a>
                    {s.publishedDate && <span className="mr-2 text-xs text-muted-foreground">({s.publishedDate})</span>}
                  </li>
                ))}
              </ul>
              {typeof details?.rejectedSourcesCount === "number" && details.rejectedSourcesCount > 0 && (
                <p className="mt-2 text-xs text-muted-foreground">
                  تم استبعاد {details.rejectedSourcesCount} مصدر إضافي أثناء فرز الصلة الآلي (منتج/دولة مختلفة أو محتوى قديم).
                </p>
              )}
            </section>
          )}
        </>
      )}
    </main>
  );
}
