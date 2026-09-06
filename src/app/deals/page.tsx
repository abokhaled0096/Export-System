import Link from "next/link";
import { getScopedPrisma } from "@/lib/scoped-prisma";
import { requireCurrentUser } from "@/lib/session";
import { getPermissionScope, scopedOwnerIdFilter } from "@/lib/permissions";
import { Prisma } from "@/generated/prisma/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import ListSearch from "@/components/ListSearch";

export const dynamic = "force-dynamic";

const columns = [
  { status: "Draft", label: "مسودة" },
  { status: "Pricing", label: "جاري التسعير" },
  { status: "Negotiation", label: "تفاوض" },
  { status: "Won", label: "مكسوبة" },
  { status: "Lost", label: "خسرانة" },
] as const;

const columnStyle: Record<string, string> = {
  Draft: "border-t-neutral-300",
  Pricing: "border-t-sky-400",
  Negotiation: "border-t-amber-400",
  Won: "border-t-emerald-500",
  Lost: "border-t-rose-400",
};

/** سقف عرض لكل عمود — القيم التجميعية (winRate/confirmedSales) بتتحسب من الـDB مباشرة (count/sum)
 * مش من الصفوف المعروضة، فبتفضل صحيحة حتى لو عدد الصفقات الكلي أكبر من السقف ده. راجع BACKLOG.md. */
const DISPLAY_CAP = 200;

export default async function DealsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const user = await requireCurrentUser();
  const orgId = user.orgId;
  const prisma = await getScopedPrisma();
  const { q } = await searchParams;

  // Own/Team scope (مثلًا SalesRep/TeamLead) بيشوف بس الصفقات اللي فرصتها الأصلية مملوكة له أو لفريقه — راجع BACKLOG.md.
  // Deal ملهوش ownerId مباشر، الملكية عبر Opportunity.ownerId.
  const scope = await getPermissionScope(user.roleId, "Deal", "View");
  const scopedOwnerId = await scopedOwnerIdFilter(scope, user);
  const dealOwnerFilter = scopedOwnerId !== undefined ? { opportunity: { ownerId: scopedOwnerId } } : {};
  const salesOrderOwnerFilter =
    scopedOwnerId !== undefined ? { deal: { opportunity: { ownerId: scopedOwnerId } } } : {};
  // البحث بيفلتر باسم العميل أو المنتج — بيأثر على الـKPIs كمان (نفس سلوك سجل التدقيق: العرض
  // المفلتر هو المرجع لما فيه بحث نشط، مش إجمالي المنظمة).
  const searchFilter = q
    ? {
        OR: [
          { customer: { legalName: { contains: q, mode: "insensitive" as const } } },
          { product: { nameAr: { contains: q, mode: "insensitive" as const } } },
        ],
      }
    : {};

  // ⚠️ مش Promise.all — راجع نفس الملاحظة في products/page.tsx (P2028): كل استعلام من
  // getScopedPrisma() بيفتح transaction لوحده، والتنفيذ بالتوازي بيتزاحم على اتصال الـpool.
  const openDeals = await prisma.deal.findMany({
    where: { orgId, deletedAt: null, status: { notIn: ["Won", "Lost", "Cancelled"] }, ...dealOwnerFilter, ...searchFilter },
    include: { customer: true, product: true, market: true, scenarios: true },
    orderBy: { createdAt: "desc" },
    take: DISPLAY_CAP,
  });
  const recentClosedDeals = await prisma.deal.findMany({
    where: { orgId, deletedAt: null, status: { in: ["Won", "Lost"] }, ...dealOwnerFilter, ...searchFilter },
    include: { customer: true, product: true, market: true, scenarios: true },
    orderBy: { updatedAt: "desc" },
    take: DISPLAY_CAP,
  });
  const closedCounts = await prisma.deal.groupBy({
    by: ["status"],
    where: { orgId, deletedAt: null, status: { in: ["Won", "Lost"] }, ...dealOwnerFilter, ...searchFilter },
    _count: true,
  });
  const salesSum = await prisma.salesOrder.aggregate({
    where: { orgId, status: { not: "Cancelled" }, ...salesOrderOwnerFilter },
    _sum: { totalValue: true },
  });
  const totalOpenCount = await prisma.deal.count({
    where: { orgId, deletedAt: null, status: { notIn: ["Won", "Lost", "Cancelled"] }, ...dealOwnerFilter, ...searchFilter },
  });

  const deals = [...openDeals, ...recentClosedDeals];

  const dealValue = (deal: (typeof deals)[number]) => {
    const scenario = deal.scenarios.find((s) => s.id === deal.activeScenarioId);
    if (!scenario) return null;
    const price = scenario.finalPrice ?? scenario.targetPrice;
    if (!price) return null;
    return price.mul(scenario.quantitySaleable);
  };

  const wonCount = closedCounts.find((c) => c.status === "Won")?._count ?? 0;
  const lostCount = closedCounts.find((c) => c.status === "Lost")?._count ?? 0;
  const closedTotal = wonCount + lostCount;

  // pipelineValue بيتحسب من openDeals المعروضة بس (لغاية DISPLAY_CAP) — مش مجموع دقيق 100%
  // لو عدد الصفقات المفتوحة أكبر من السقف، لكن ده وضع نادر عمليًا (pipeline نشط بهذا الحجم
  // نادر لمنظومة داخلية)، عكس winRate/confirmedSales اللي بيتحسبوا من الـDB مباشرة فدايمًا دقيقين.
  const pipelineValue = openDeals.reduce(
    (sum, d) => sum.add(dealValue(d) ?? new Prisma.Decimal(0)),
    new Prisma.Decimal(0)
  );
  const winRate = closedTotal > 0 ? Math.round((wonCount / closedTotal) * 100) : null;
  const confirmedSales = salesSum._sum.totalValue ?? new Prisma.Decimal(0);

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">الصفقات</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {totalOpenCount} صفقة مفتوحة{deals.length < totalOpenCount + closedTotal ? ` (معروض آخر ${DISPLAY_CAP} من كل عمود)` : ""}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            nativeButton={false}
            variant="outline"
            render={<a href={`/deals/export${q ? `?q=${encodeURIComponent(q)}` : ""}`}>تصدير CSV</a>}
          />
          <ListSearch basePath="/deals" q={q} placeholder="اسم العميل أو المنتج..." />
        </div>
      </div>

      {deals.length === 0 ? (
        <div className="mt-10 rounded-xl border border-dashed border-border py-16 text-center text-muted-foreground">
          {q ? (
            <p>مفيش صفقات مطابقة للبحث ده.</p>
          ) : (
            <>
              <p>لسه مفيش صفقات. حوّل فرصة موجودة لصفقة من صفحة الفرص.</p>
              <Button nativeButton={false} variant="link" render={<Link href="/opportunities">روح لصفحة الفرص</Link>} />
            </>
          )}
        </div>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Card>
              <CardContent>
                <p className="text-xs text-muted-foreground">صفقات مفتوحة</p>
                <p className="mt-1 font-mono text-2xl text-foreground">{totalOpenCount}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent>
                <p className="text-xs text-muted-foreground">قيمة الـpipeline التقديرية</p>
                <p className="mt-1 font-mono text-2xl text-foreground">{pipelineValue.toFixed(0)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent>
                <p className="text-xs text-muted-foreground">نسبة الفوز</p>
                <p className="mt-1 font-mono text-2xl text-foreground">{winRate === null ? "—" : `${winRate}%`}</p>
              </CardContent>
            </Card>
            <Card className="border-emerald-200 bg-emerald-50">
              <CardContent>
                <p className="text-xs text-emerald-700">مبيعات مؤكّدة (أوامر بيع)</p>
                <p className="mt-1 font-mono text-2xl text-emerald-900">{confirmedSales.toFixed(0)}</p>
              </CardContent>
            </Card>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 overflow-x-auto sm:grid-cols-5">
            {columns.map((col) => {
              const colDeals = deals.filter((d) => d.status === col.status);
              return (
                <div
                  key={col.status}
                  className={`rounded-xl border-t-4 bg-muted/40 p-3 ${columnStyle[col.status]}`}
                >
                  <div className="flex items-center justify-between px-1">
                    <h2 className="text-sm font-semibold text-foreground/80">{col.label}</h2>
                    <span className="text-xs text-muted-foreground">{colDeals.length}</span>
                  </div>
                  <div className="mt-3 flex flex-col gap-2">
                    {colDeals.map((d) => {
                      const value = dealValue(d);
                      return (
                        <Link
                          key={d.id}
                          href={`/deals/${d.id}`}
                          className="block rounded-lg border border-border bg-card p-3 text-sm hover:border-emerald-400 hover:shadow-sm"
                        >
                          <p className="font-medium text-foreground">{d.customer.legalName}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {d.product.nameAr} · {d.market.countryNameAr}
                          </p>
                          {value && (
                            <p className="mt-1 font-mono text-xs text-foreground/70">
                              {value.toFixed(0)} {d.scenarios[0]?.currency}
                            </p>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </main>
  );
}
