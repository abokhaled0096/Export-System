import Link from "next/link";
import { getScopedPrisma } from "@/lib/scoped-prisma";
import { getCurrentOrgId } from "@/lib/org";
import { requireCurrentUser } from "@/lib/session";
import { requirePermission } from "@/lib/permissions";
import { computeCurrentSeasonalWindow } from "@/lib/opportunityScoring";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import ProductPicker from "./ProductPicker";

export const dynamic = "force-dynamic";

const recLabel: Record<string, string> = { Start: "ابدأ", Study: "ادرس أكتر", Monitor: "راقب", Avoid: "تجنّب" };
const recStyle: Record<string, string> = {
  Start: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  Study: "bg-sky-100 text-sky-700 hover:bg-sky-100",
  Monitor: "bg-amber-100 text-amber-700 hover:bg-amber-100",
  Avoid: "bg-rose-100 text-rose-700 hover:bg-rose-100",
};

function riskBadge(score: number | null) {
  if (score === null) return <Badge className="bg-secondary text-secondary-foreground hover:bg-secondary">غير مقيَّمة</Badge>;
  const style = score < 34 ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100" : score < 67 ? "bg-amber-100 text-amber-700 hover:bg-amber-100" : "bg-rose-100 text-rose-700 hover:bg-rose-100";
  return <Badge className={style}>{score}</Badge>;
}

export default async function MarketComparePage({ searchParams }: { searchParams: Promise<{ productId?: string }> }) {
  const user = await requireCurrentUser();

  try {
    await requirePermission(user.roleId, "Market", "View");
    await requirePermission(user.roleId, "Product", "View");
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
  const { productId } = await searchParams;

  // ⚠️ مش Promise.all — راجع BACKLOG.md (P2028).
  const products = await prisma.product.findMany({ where: { orgId, deletedAt: null }, orderBy: { nameAr: "asc" } });
  const markets = await prisma.market.findMany({ where: { orgId, deletedAt: null }, orderBy: { countryNameAr: "asc" } });

  const product = productId ? products.find((p) => p.id === productId) : undefined;

  let rows: {
    market: (typeof markets)[number];
    analysis: { opportunityScore: number; riskScore: number; recommendation: string } | null;
    competitorCount: number;
    seasonalWindow: { weakCount: number; strongCount: number; total: number };
  }[] = [];

  if (product) {
    const currentMonth = new Date().getMonth() + 1;
    for (const market of markets) {
      const analysis = await prisma.productMarketAnalysis.findFirst({
        where: { productId: product.id, marketId: market.id, orgId },
        orderBy: { createdAt: "desc" },
        select: { opportunityScore: true, riskScore: true, recommendation: true },
      });
      const competitors = await prisma.competitor.findMany({
        where: { productId: product.id, marketId: market.id, deletedAt: null },
        select: { strengthMonths: true, weaknessMonths: true },
      });
      rows.push({
        market,
        analysis,
        competitorCount: competitors.length,
        seasonalWindow: computeCurrentSeasonalWindow(competitors, currentMonth),
      });
    }
    rows = rows.sort((a, b) => (b.analysis?.opportunityScore ?? -1) - (a.analysis?.opportunityScore ?? -1));
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <Button nativeButton={false} variant="link" className="h-auto p-0" render={<Link href="/markets">← رجوع للأسواق</Link>} />
      <h1 className="mt-3 text-2xl font-semibold text-foreground">لوحة مقارنة الأسواق</h1>
      <p className="mt-1 text-sm text-muted-foreground">قارن كل الأسواق المسجّلة لمنتج معيّن — المخاطرة، آخر تحليل، عدد المنافسين، والنافذة الموسمية الحالية.</p>

      <div className="mt-6">
        <ProductPicker products={products.map((p) => ({ id: p.id, label: `${p.nameAr} (${p.nameEn})` }))} selectedProductId={productId} />
      </div>

      {!product ? (
        <div className="mt-10 rounded-xl border border-dashed border-border py-16 text-center text-muted-foreground">
          اختر منتج فوق عشان تشوف مقارنة الأسواق ليه.
        </div>
      ) : rows.length === 0 ? (
        <div className="mt-10 rounded-xl border border-dashed border-border py-16 text-center text-muted-foreground">
          لسه مفيش أسواق مسجّلة.
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>السوق</TableHead>
                <TableHead>مخاطرة سياسية</TableHead>
                <TableHead>مخاطرة لوجستية</TableHead>
                <TableHead>آخر تحليل</TableHead>
                <TableHead>منافسين مسجّلين</TableHead>
                <TableHead>الوضع الموسمي الحالي</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(({ market, analysis, competitorCount, seasonalWindow }) => (
                <TableRow key={market.id}>
                  <TableCell>
                    <Button nativeButton={false} variant="link" className="h-auto p-0 font-medium" render={<Link href={`/markets/${market.id}`}>{market.countryNameAr}</Link>} />
                  </TableCell>
                  <TableCell>{riskBadge(market.politicalRiskScore)}</TableCell>
                  <TableCell>{riskBadge(market.logisticsRiskScore)}</TableCell>
                  <TableCell>
                    {analysis ? (
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-foreground/80">
                          {analysis.opportunityScore}/{analysis.riskScore}
                        </span>
                        <Badge className={recStyle[analysis.recommendation]}>{recLabel[analysis.recommendation]}</Badge>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">مفيش تحليل</span>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-foreground/80">{competitorCount}</TableCell>
                  <TableCell className="text-xs">
                    {seasonalWindow.total === 0 ? (
                      <span className="text-muted-foreground">مفيش بيانات منافسين موسمية</span>
                    ) : seasonalWindow.weakCount > seasonalWindow.strongCount ? (
                      <span className="text-emerald-700">
                        🟢 {seasonalWindow.weakCount} من {seasonalWindow.total} منافس ضعيف الشهر ده — فرصة
                      </span>
                    ) : seasonalWindow.strongCount > seasonalWindow.weakCount ? (
                      <span className="text-rose-700">
                        🔴 {seasonalWindow.strongCount} من {seasonalWindow.total} منافس قوي الشهر ده — منافسة عالية
                      </span>
                    ) : (
                      <span className="text-muted-foreground">محايد الشهر ده</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </main>
  );
}
