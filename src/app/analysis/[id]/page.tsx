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

  const sources = Array.isArray(analysis.aiSources)
    ? (analysis.aiSources as { title: string; url: string }[])
    : [];

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
        <Badge className={`px-3 py-1.5 text-sm ${recStyle[analysis.recommendation]}`}>
          التوصية: {recLabel[analysis.recommendation]}
        </Badge>
      </div>

      {analysis.source === "AI" && (
        <>
          <section className="mt-8">
            <h2 className="text-lg font-medium text-foreground">سبب التقييم</h2>
            <Card className="mt-3">
              <CardContent>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/80">
                  {analysis.aiReasoning}
                </p>
              </CardContent>
            </Card>
          </section>

          {sources.length > 0 && (
            <section className="mt-6">
              <h2 className="text-lg font-medium text-foreground">المصادر</h2>
              <ul className="mt-3 flex flex-col gap-2">
                {sources.map((s, i) => (
                  <li key={i}>
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:underline"
                    >
                      {s.title}
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </main>
  );
}
