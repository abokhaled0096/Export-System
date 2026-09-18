import Link from "next/link";
import { getScopedPrisma } from "@/lib/scoped-prisma";
import { requireCurrentUser } from "@/lib/session";
import { getPermissionScope, scopedOwnerIdFilter } from "@/lib/permissions";
import { Prisma } from "@/generated/prisma/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import ListSearch from "@/components/ListSearch";
import KanbanColumn, { type DealCardData } from "./KanbanColumn";

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

/** صفحة أولى لكل عمود — pagination حقيقي مستقل بعد كده (زرار "تحميل المزيد"، KanbanColumn.tsx)
 * بدل سقف إجمالي واحد بيتقسّم بين الأعمدة. ⚠️ لازم يتطابق مع KANBAN_PAGE_SIZE في actions.ts. */
const PAGE_SIZE = 30;

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
  //
  // pagination حقيقي مستقل لكل عمود Kanban (بدل سقف إجمالي واحد بيتقسّم بين الأعمدة) — راجع
  // BACKLOG.md § P2/P3. عدد كل عمود بيتحسب بـgroupBy واحد على كل الحالات الخمسة (مش عدّ الصفوف
  // المعروضة)، فبيفضل دقيق حتى لو العمود فيه أكتر من صفحة واحدة.
  const allStatusCounts = await prisma.deal.groupBy({
    by: ["status"],
    where: { orgId, deletedAt: null, status: { in: ["Draft", "Pricing", "Negotiation", "Won", "Lost"] }, ...dealOwnerFilter, ...searchFilter },
    _count: true,
  });
  const countFor = (status: string) => allStatusCounts.find((c) => c.status === status)?._count ?? 0;

  const dealValue = (deal: { activeScenarioId: string | null; scenarios: { id: string; finalPrice: Prisma.Decimal | null; targetPrice: Prisma.Decimal | null; quantitySaleable: Prisma.Decimal; currency: string }[] }) => {
    const scenario = deal.scenarios.find((s) => s.id === deal.activeScenarioId);
    if (!scenario) return null;
    const price = scenario.finalPrice ?? scenario.targetPrice;
    if (!price) return null;
    return { value: price.mul(scenario.quantitySaleable), currency: scenario.currency };
  };

  const columnPages: Record<string, { deals: DealCardData[]; hasMore: boolean }> = {};
  for (const col of columns) {
    const isClosed = col.status === "Won" || col.status === "Lost";
    const rows = await prisma.deal.findMany({
      where: { orgId, deletedAt: null, status: col.status, ...dealOwnerFilter, ...searchFilter },
      include: { customer: true, product: true, market: true, scenarios: true },
      orderBy: isClosed ? { updatedAt: "desc" } : { createdAt: "desc" },
      take: PAGE_SIZE + 1,
    });
    const hasMore = rows.length > PAGE_SIZE;
    columnPages[col.status] = {
      hasMore,
      deals: rows.slice(0, PAGE_SIZE).map((d) => {
        const v = dealValue(d);
        return { id: d.id, customerName: d.customer.legalName, productName: d.product.nameAr, marketName: d.market.countryNameAr, value: v?.value.toFixed(0) ?? null, currency: v?.currency ?? null };
      }),
    };
  }

  const salesSum = await prisma.salesOrder.aggregate({
    where: { orgId, status: { not: "Cancelled" }, ...salesOrderOwnerFilter },
    _sum: { totalValue: true },
  });

  // إجمالي دقيق 100% — بلا سقف عرض، عكس النسخة القديمة اللي كانت بتحسب من أول DISPLAY_CAP
  // صفقة مفتوحة بس (راجع BACKLOG.md). select ضيّق (بلا include كامل) عشان الاستعلام يفضل خفيف
  // حتى لو عدد الصفقات المفتوحة كبير.
  const openDealsForValue = await prisma.deal.findMany({
    where: { orgId, deletedAt: null, status: { in: ["Draft", "Pricing", "Negotiation"] }, ...dealOwnerFilter, ...searchFilter },
    select: { activeScenarioId: true, scenarios: { select: { id: true, finalPrice: true, targetPrice: true, quantitySaleable: true, currency: true } } },
  });
  const pipelineValue = openDealsForValue.reduce(
    (sum, d) => sum.add(dealValue(d)?.value ?? new Prisma.Decimal(0)),
    new Prisma.Decimal(0)
  );

  const totalOpenCount = countFor("Draft") + countFor("Pricing") + countFor("Negotiation");
  const wonCount = countFor("Won");
  const lostCount = countFor("Lost");
  const closedTotal = wonCount + lostCount;
  const winRate = closedTotal > 0 ? Math.round((wonCount / closedTotal) * 100) : null;
  const confirmedSales = salesSum._sum.totalValue ?? new Prisma.Decimal(0);
  const totalDealsCount = totalOpenCount + closedTotal;

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">الصفقات</h1>
          <p className="mt-1 text-sm text-muted-foreground">{totalOpenCount} صفقة مفتوحة</p>
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

      {totalDealsCount === 0 ? (
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
            {columns.map((col) => (
              <KanbanColumn
                key={col.status}
                status={col.status}
                label={col.label}
                borderClass={columnStyle[col.status]}
                totalCount={countFor(col.status)}
                initialDeals={columnPages[col.status].deals}
                initialHasMore={columnPages[col.status].hasMore}
                q={q}
              />
            ))}
          </div>
        </>
      )}
    </main>
  );
}
