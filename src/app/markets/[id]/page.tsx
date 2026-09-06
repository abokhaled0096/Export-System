import Link from "next/link";
import { notFound } from "next/navigation";
import { getScopedPrisma } from "@/lib/scoped-prisma";
import { requireCurrentUser } from "@/lib/session";
import { requirePermission } from "@/lib/permissions";
import MarketEditForm from "./MarketEditForm";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const dynamic = "force-dynamic";

const recLabel: Record<string, string> = { Start: "ابدأ", Study: "ادرس أكتر", Monitor: "راقب", Avoid: "تجنّب" };
const recStyle: Record<string, string> = {
  Start: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  Study: "bg-sky-100 text-sky-700 hover:bg-sky-100",
  Monitor: "bg-amber-100 text-amber-700 hover:bg-amber-100",
  Avoid: "bg-rose-100 text-rose-700 hover:bg-rose-100",
};

function riskLabel(score: number | null): { label: string; style: string } {
  if (score === null) return { label: "غير مقيَّمة", style: "bg-secondary text-secondary-foreground hover:bg-secondary" };
  if (score < 34) return { label: `منخفضة (${score})`, style: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100" };
  if (score < 67) return { label: `متوسطة (${score})`, style: "bg-amber-100 text-amber-700 hover:bg-amber-100" };
  return { label: `عالية (${score})`, style: "bg-rose-100 text-rose-700 hover:bg-rose-100" };
}

export default async function MarketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireCurrentUser();

  try {
    await requirePermission(user.roleId, "Market", "View");
  } catch {
    return (
      <main className="mx-auto max-w-3xl px-6 py-10">
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-6 text-center text-sm text-destructive">
          معندكش صلاحية الوصول للصفحة دي.
        </div>
      </main>
    );
  }

  const orgId = user.orgId;
  const prisma = await getScopedPrisma();

  const market = await prisma.market.findFirst({ where: { id, orgId, deletedAt: null } });
  if (!market) notFound();

  // ⚠️ مش Promise.all — راجع BACKLOG.md (P2028).
  const analyses = await prisma.productMarketAnalysis.findMany({
    where: { marketId: id, orgId },
    include: { product: true },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  const competitorCount = await prisma.competitor.count({ where: { marketId: id, orgId, deletedAt: null } });

  const political = riskLabel(market.politicalRiskScore);
  const logistics = riskLabel(market.logisticsRiskScore);

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <Button nativeButton={false} variant="link" className="px-0" render={<Link href="/markets">← رجوع للأسواق</Link>} />

      <div className="mt-3 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{market.countryNameAr}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {market.countryNameEn} · {market.countryCode} · {market.continent}
          </p>
        </div>
        <Link href={`/markets/compare?marketId=${market.id}`} className="text-sm text-primary hover:underline">
          قارن بأسواق تانية →
        </Link>
      </div>

      <dl className="mt-4 grid gap-4 rounded-xl border border-border bg-card p-5 sm:grid-cols-3">
        <div>
          <dt className="text-xs text-muted-foreground">العملة</dt>
          <dd className="font-mono text-foreground">{market.currency}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">الموانئ الرئيسية</dt>
          <dd className="text-foreground">{market.mainPorts.join("، ") || "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">اتفاقية تجارية</dt>
          <dd className="text-foreground">{market.tradeAgreement ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">المخاطرة السياسية</dt>
          <dd><Badge className={political.style}>{political.label}</Badge></dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">المخاطرة اللوجستية</dt>
          <dd><Badge className={logistics.style}>{logistics.label}</Badge></dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">آخر مراجعة</dt>
          <dd className="text-foreground">{market.lastReviewedAt ? market.lastReviewedAt.toLocaleDateString("ar-EG") : "لسه ماتراجعتش"}</dd>
        </div>
        <div className="sm:col-span-3">
          <dt className="text-xs text-muted-foreground">منافسين مسجّلين في السوق ده</dt>
          <dd className="text-foreground">{competitorCount}</dd>
        </div>
      </dl>

      <section className="mt-8">
        <h2 className="text-lg font-medium text-foreground">تحديث تقييم المخاطرة</h2>
        <div className="mt-3">
          <MarketEditForm
            marketId={market.id}
            tradeAgreement={market.tradeAgreement}
            politicalRiskScore={market.politicalRiskScore}
            logisticsRiskScore={market.logisticsRiskScore}
          />
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-medium text-foreground">تحليلات المنتج/السوق المرتبطة</h2>
        <div className="mt-3 overflow-x-auto rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>المنتج</TableHead>
                <TableHead>السنة</TableHead>
                <TableHead>درجة الفرصة</TableHead>
                <TableHead>درجة المخاطرة</TableHead>
                <TableHead>التوصية</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {analyses.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-6 text-center text-muted-foreground">
                    لسه مفيش تحليلات لهذا السوق.
                  </TableCell>
                </TableRow>
              ) : (
                analyses.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>
                      <Button nativeButton={false} variant="link" className="h-auto p-0" render={<Link href={`/analysis/${a.id}`}>{a.product.nameAr}</Link>} />
                    </TableCell>
                    <TableCell className="font-mono text-foreground/80">{a.year}</TableCell>
                    <TableCell className="font-mono text-foreground/80">{a.opportunityScore}</TableCell>
                    <TableCell className="font-mono text-foreground/80">{a.riskScore}</TableCell>
                    <TableCell>
                      <Badge className={recStyle[a.recommendation]}>{recLabel[a.recommendation]}</Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>
    </main>
  );
}
