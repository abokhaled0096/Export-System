import Link from "next/link";
import { notFound } from "next/navigation";
import { getScopedPrisma } from "@/lib/scoped-prisma";
import { requireCurrentUser } from "@/lib/session";
import { getPermissionScope, scopedOwnerIdFilter, getFieldAccess } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const dynamic = "force-dynamic";

function fmt(value: unknown) {
  if (value === null || value === undefined) return "—";
  return Number(value).toLocaleString("en-US", { maximumFractionDigits: 2 });
}

export default async function CompareScenariosPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireCurrentUser();
  const orgId = user.orgId;
  const prisma = await getScopedPrisma();
  // نفس القاعدة في /deals/[id]/page.tsx — SalesRep (Own scope) مايشوفش بيانات التسعير/الربح
  // الداخلية (نقطة التعادل، الحد الأدنى، الربح والهامش)، بس اللي بيتفاوض عليه فعليًا مع العميل.
  // بقى مبني على FieldPermission (وحدة 9، راجع STATUS.md 7 سبتمبر) بدل Deal.View scope كـproxy.
  const canSeeInternalPricing = (await getFieldAccess(user.roleId, "DealScenario", "walkAwayPrice")) !== "Hidden";
  // ⚠️ نفس فجوة IDOR في /deals/[id] — اتكشف هنا كمان في إعادة مراجعة وحدة 2 (7 سبتمبر).
  const dealViewScope = await getPermissionScope(user.roleId, "Deal", "View");
  const scopedOwnerId = await scopedOwnerIdFilter(dealViewScope, user);
  const ownerWhere = scopedOwnerId !== undefined ? { opportunity: { ownerId: scopedOwnerId } } : {};
  const restrictedRowLabels = new Set([
    "نقطة التعادل",
    "الحد الأدنى (walkAwayPrice)",
    "الربح المتوقع",
    "هامش الربح %",
    "نسبة الماركاپ %",
    "إجمالي تكلفة المخاطر المتوقعة",
    "الربح المعدَّل بالمخاطر",
  ]);

  const deal = await prisma.deal.findFirst({
    where: { id, orgId, ...ownerWhere },
    include: {
      customer: true,
      product: true,
      scenarios: {
        orderBy: { version: "asc" },
        include: { riskItems: true },
      },
    },
  });
  if (!deal) notFound();
  if (deal.scenarios.length === 0) notFound();

  const rows: {
    label: string;
    value: (s: NonNullable<typeof deal>["scenarios"][number]) => string;
    highlight?: boolean;
  }[] = [
    { label: "الحالة", value: (s) => (s.isLocked ? "مقفول" : "مفتوح للتعديل") },
    { label: "الكمية القابلة للبيع", value: (s) => `${fmt(s.quantitySaleable)} ${s.currency}` },
    { label: "Incoterm", value: (s) => s.incoterm },
    { label: "نقطة التعادل", value: (s) => `${fmt(s.breakEvenPrice)} ${s.currency}` },
    { label: "الحد الأدنى (walkAwayPrice)", value: (s) => `${fmt(s.walkAwayPrice)} ${s.currency}` },
    { label: "السعر الافتتاحي", value: (s) => (s.openingPrice ? `${fmt(s.openingPrice)} ${s.currency}` : "—") },
    { label: "السعر المستهدف", value: (s) => (s.targetPrice ? `${fmt(s.targetPrice)} ${s.currency}` : "—") },
    { label: "السعر النهائي", value: (s) => (s.finalPrice ? `${fmt(s.finalPrice)} ${s.currency}` : "—") },
    {
      label: "الربح المتوقع",
      value: (s) => (s.expectedProfit ? `${fmt(s.expectedProfit)} ${s.currency}` : "—"),
      highlight: true,
    },
    {
      label: "هامش الربح %",
      value: (s) => (s.expectedMarginPct ? `${fmt(s.expectedMarginPct)}%` : "—"),
    },
    {
      label: "نسبة الماركاپ %",
      value: (s) => (s.expectedMarkupPct ? `${fmt(s.expectedMarkupPct)}%` : "—"),
    },
    {
      label: "عدد بنود المخاطر",
      value: (s) => String(s.riskItems.length),
    },
    {
      label: "إجمالي تكلفة المخاطر المتوقعة",
      value: (s) => {
        const total = s.riskItems.reduce((sum, r) => sum + Number(r.expectedCost), 0);
        return total > 0 ? `${fmt(total)} ${s.currency}` : "—";
      },
    },
    {
      label: "الربح المعدَّل بالمخاطر",
      value: (s) => {
        if (!s.expectedProfit) return "—";
        const riskCost = s.riskItems.reduce((sum, r) => sum + Number(r.expectedCost), 0);
        const adjusted = Number(s.expectedProfit) - riskCost;
        return `${fmt(adjusted)} ${s.currency}`;
      },
      highlight: true,
    },
  ];
  const visibleRows = canSeeInternalPricing ? rows : rows.filter((r) => !restrictedRowLabels.has(r.label));

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <Button nativeButton={false} variant="link" className="px-0" render={<Link href={`/deals/${id}`}>← رجوع للصفقة</Link>} />
      <h1 className="mt-3 text-2xl font-semibold text-foreground">
        مقارنة السيناريوهات — {deal.customer.legalName} · {deal.product.nameAr}
      </h1>

      <Card className="mt-6">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="sticky start-0 bg-muted/40">المقياس</TableHead>
                {deal.scenarios.map((s) => (
                  <TableHead key={s.id}>
                    <div className="flex items-center gap-2">
                      {s.scenarioName} (v{s.version})
                      {s.id === deal.activeScenarioId && (
                        <Badge className="bg-emerald-100 text-[10px] text-emerald-700 hover:bg-emerald-100">
                          النشط
                        </Badge>
                      )}
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleRows.map((row) => (
                <TableRow key={row.label}>
                  <TableCell className="sticky start-0 bg-card font-medium text-foreground/80">
                    {row.label}
                  </TableCell>
                  {deal.scenarios.map((s) => (
                    <TableCell
                      key={s.id}
                      className={`font-mono ${row.highlight ? "font-semibold text-emerald-800" : "text-foreground/80"}`}
                    >
                      {row.value(s)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </main>
  );
}
