import Link from "next/link";
import { notFound } from "next/navigation";
import { getScopedPrisma } from "@/lib/scoped-prisma";
import { getCurrentOrgId } from "@/lib/org";
import { requireCurrentUser } from "@/lib/session";
import { requirePermission, getPermissionScope } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

// نفس الاختصارات المستخدمة في src/app/competitors/page.tsx — اتساق بين الصفحتين.
const monthShort = ["", "ينا", "فبر", "مار", "أبر", "ماي", "يون", "يول", "أغس", "سبت", "أكت", "نوف", "ديس"];

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
  ruleBasedComparison?: { opportunityScore: number; riskScore: number; reasoning: string[]; opportunityDiff: number; riskDiff: number };
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

  // ⚠️ مش Promise.all — راجع BACKLOG.md (P2028). الأزرار اللي بتودّي لصفحات تانية (فرصة/مخاطرة/
  // متطلب) بتتحقق من صلاحية الوجهة هنا وتتخفي لو المستخدم مش هيقدر يعمل حاجة هناك أصلًا — بدل ما
  // تظهر وتوصله لصفحة "معندكش صلاحية" (اتلاحظ حيًا: الاتنين متسابين بلا فحص لحد المراجعة دي).
  const canCreateOpportunity = await getPermissionScope(user.roleId, "Opportunity", "Create");
  const canCreateRisk = await getPermissionScope(user.roleId, "RiskRegisterItem", "Create");
  const canCreateRequirement = await getPermissionScope(user.roleId, "Requirement", "Create");
  const canCreateCompetitor = await getPermissionScope(user.roleId, "Competitor", "Create");

  const analysis = await prisma.productMarketAnalysis.findFirst({
    where: { id, orgId },
    include: { product: true, market: true },
  });
  if (!analysis) notFound();

  // آخر نسخة سابقة لنفس التركيبة (منتج×سوق×سنة) قبل التحليل ده — بيانات فعلية موجودة أصلًا
  // (كل تحليل جديد بيعمل supersede للقديم، migration 20260909120000)، بس ماكانتش معروضة قبل كده.
  // بيحل عيب BACKLOG.md § P2/P3 ("هل الدرجة اتغيّرت بشكل ملحوظ من آخر مرة؟" مش قابل للحساب).
  const previousAnalysis = await prisma.productMarketAnalysis.findFirst({
    where: {
      orgId,
      productId: analysis.productId,
      marketId: analysis.marketId,
      year: analysis.year,
      id: { not: analysis.id },
      createdAt: { lt: analysis.createdAt },
    },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true, opportunityScore: true, riskScore: true },
  });

  // منافسين حقيقيين مسجّلين لنفس التركيبة — مصدر النافذة الموسمية تحت. بلا AI هنا، بيانات
  // فعلية بس (source ممكن يكون AI أو Manual، المهم إنها strengthMonths/weaknessMonths حقيقية
  // اتسجّلت قبل كده، مش تخمين وقت عرض الصفحة).
  const competitors = await prisma.competitor.findMany({
    where: { productId: analysis.productId, marketId: analysis.marketId, orgId, deletedAt: null },
    select: { countryName: true, strengthMonths: true, weaknessMonths: true, priceRangeMin: true, priceRangeMax: true, currency: true },
  });

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

      {previousAnalysis && (
        <p className="mt-2 text-xs text-muted-foreground">
          آخر تحليل سابق لنفس المنتج×السوق×السنة كان بتاريخ {previousAnalysis.createdAt.toISOString().slice(0, 10)}:{" "}
          <span className={analysis.opportunityScore === previousAnalysis.opportunityScore ? "" : analysis.opportunityScore > previousAnalysis.opportunityScore ? "text-emerald-700" : "text-rose-700"}>
            الفرصة {analysis.opportunityScore > previousAnalysis.opportunityScore ? "+" : ""}
            {analysis.opportunityScore - previousAnalysis.opportunityScore}
          </span>
          {" · "}
          <span className={analysis.riskScore === previousAnalysis.riskScore ? "" : analysis.riskScore > previousAnalysis.riskScore ? "text-rose-700" : "text-emerald-700"}>
            المخاطرة {analysis.riskScore > previousAnalysis.riskScore ? "+" : ""}
            {analysis.riskScore - previousAnalysis.riskScore}
          </span>
        </p>
      )}

      <div className="mt-4 flex items-center gap-3">
        <Badge className={`px-3 py-1.5 text-sm ${recStyle[analysis.recommendation]}`}>التوصية: {recLabel[analysis.recommendation]}</Badge>
        {canCreateOpportunity && (
          <Button
            nativeButton={false}
            size="sm"
            variant="outline"
            render={
              <Link
                href={`/opportunities/new?${new URLSearchParams({
                  productId: analysis.productId,
                  marketId: analysis.marketId,
                  ...(details?.priceEstimate?.currency ? { currency: details.priceEstimate.currency } : {}),
                }).toString()}`}
              >
                🎯 حوّل لفرصة (Opportunity)
              </Link>
            }
          />
        )}
      </div>
      {canCreateOpportunity && (
        <p className="mt-1 text-xs text-muted-foreground">
          التحليل ده تقييم سوق عام — محتاج تختار عميل معيّن عشان يتحوّل لفرصة، وبعدين لصفقة بمحرك التسعير الحقيقي (walkAwayPrice/breakEvenPrice).
        </p>
      )}

      {analysis.needsReview && details?.ruleBasedComparison && (
        <section className="mt-6">
          <Card className="border-rose-300 bg-rose-50">
            <CardContent>
              <p className="flex items-center gap-1.5 text-sm font-medium text-rose-700">🚩 تقييم الـAI بعيد عن اقتراح محرك القواعد — راجع قبل ما تاخد قرار عليه</p>
              <p className="mt-2 text-sm text-rose-700/90">
                الـAI: فرصة {analysis.opportunityScore} / مخاطرة {analysis.riskScore} — محرك القواعد (بيانات حقيقية مسجّلة: مخاطرة السوق، مواسم التوفّر، منافسين): فرصة{" "}
                {details.ruleBasedComparison.opportunityScore} / مخاطرة {details.ruleBasedComparison.riskScore}
                {" "}(فرق {details.ruleBasedComparison.opportunityDiff} و{details.ruleBasedComparison.riskDiff} نقطة على التوالي).
              </p>
              {details.ruleBasedComparison.reasoning.length > 0 && (
                <ul className="mt-2 flex flex-col gap-1 text-xs text-rose-700/80">
                  {details.ruleBasedComparison.reasoning.map((r, i) => (
                    <li key={i}>• {r}</li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </section>
      )}

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
                      <li key={i} className="flex items-start justify-between gap-2">
                        <span className="flex gap-2">
                          <span className="text-rose-600">⚠</span>
                          <span>
                            {claimText(r)}
                            <SourceRefs refs={claimRefs(r)} />
                          </span>
                        </span>
                        {canCreateRisk && (
                          <Link
                            href={`/governance/risks?${new URLSearchParams({
                              title: `${claimText(r)} — ${analysis.product.nameAr} × ${analysis.market.countryNameAr}`,
                              category: "امتثال",
                            }).toString()}`}
                            className="shrink-0 text-xs text-primary hover:underline"
                          >
                            🚩 سجّل كمخاطرة
                          </Link>
                        )}
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
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-medium text-foreground">الالتزامات التنظيمية</h2>
                {canCreateRequirement && (
                  <Link
                    href={`/compliance/requirements?${new URLSearchParams({ productId: analysis.productId, marketId: analysis.marketId }).toString()}`}
                    className="text-xs text-primary hover:underline"
                  >
                    📋 سجّل متطلبات دخول هذا السوق
                  </Link>
                )}
              </div>
              <Card className="mt-3">
                <CardContent>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/80">{details.regulatoryNotes}</p>
                </CardContent>
              </Card>
              {canCreateRequirement && (
                <p className="mt-1 text-xs text-muted-foreground">
                  النص فوق ده فقرة عامة من الـAI — الزرار بياخدك لصفحة تسجيل متطلبات حقيقية (منتج+سوق متملّيين)، إنت بتحدد كل شهادة/متطلب باسمه بنفسك بعد قراءة الفقرة.
                </p>
              )}
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

      <section className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium text-foreground">التقويم الموسمي مقابل المنافسين</h2>
          {canCreateCompetitor && (
            <Link
              href={`/competitors/ai/new?${new URLSearchParams({ productId: analysis.productId, marketId: analysis.marketId }).toString()}`}
              className="text-xs text-primary hover:underline"
            >
              {competitors.length > 0 ? "🔍 حدّث بيانات المنافسين" : "🔍 ابحث عن منافسين"}
            </Link>
          )}
        </div>

        {competitors.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
            لسه مفيش منافسين مسجّلين لهذه التركيبة — التقويم الموسمي محتاج بيانات منافسين حقيقية (شهور قوتهم/ضعفهم) عشان يبان.
          </p>
        ) : (
          <>
            <p className="mt-1 text-xs text-muted-foreground">
              مبني على {competitors.length} منافس مسجّل فعليًا (مش تخمين) — مش منحنى سعر شهري حقيقي، لأن مفيش بيانات سعر شهرية بتتسجّل حاليًا في النظام (بس نطاق سعر إجمالي لكل منافس، تحت).
            </p>
            <div className="mt-3 overflow-x-auto rounded-xl border border-border bg-card">
              <table className="w-full text-center text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="p-2 text-xs font-medium text-muted-foreground">الشهر</th>
                    {monthShort.slice(1).map((m) => (
                      <th key={m} className="p-2 text-xs font-medium text-muted-foreground">
                        {m}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-border">
                    <td className="p-2 text-xs text-muted-foreground">منتجنا متوفر</td>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                      <td key={month} className="p-2">
                        {analysis.product.availableMonths.includes(month) ? "✅" : "—"}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b border-border">
                    <td className="p-2 text-xs text-muted-foreground">منافسين ضعاف (فرصة)</td>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => {
                      const weak = competitors.filter((c) => c.weaknessMonths.includes(month)).length;
                      return (
                        <td key={month} className={`p-2 font-mono ${weak > 0 ? "text-emerald-700" : "text-muted-foreground/50"}`}>
                          {weak || "—"}
                        </td>
                      );
                    })}
                  </tr>
                  <tr>
                    <td className="p-2 text-xs text-muted-foreground">منافسين أقوياء (منافسة)</td>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => {
                      const strong = competitors.filter((c) => c.strengthMonths.includes(month)).length;
                      return (
                        <td key={month} className={`p-2 font-mono ${strong > 0 ? "text-rose-700" : "text-muted-foreground/50"}`}>
                          {strong || "—"}
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-card">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="p-2 text-right text-xs font-medium text-muted-foreground">المنافس</th>
                    <th className="p-2 text-right text-xs font-medium text-muted-foreground">نطاق السعر الإجمالي (مش شهري)</th>
                  </tr>
                </thead>
                <tbody>
                  {competitors.map((c, i) => (
                    <tr key={i} className="border-b border-border last:border-0">
                      <td className="p-2 text-foreground/80">{c.countryName}</td>
                      <td className="p-2 font-mono text-foreground/80">
                        {c.priceRangeMin && c.priceRangeMax ? `${Number(c.priceRangeMin).toLocaleString()} – ${Number(c.priceRangeMax).toLocaleString()} ${c.currency}` : "غير مسجَّل"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
