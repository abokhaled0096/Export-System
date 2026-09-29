import { Prisma } from "@/generated/prisma/client";
import type { getScopedPrisma } from "@/lib/scoped-prisma";
import { computeIncomeStatement } from "@/lib/financialStatements";

type ScopedPrismaClient = Awaited<ReturnType<typeof getScopedPrisma>>;

/**
 * بيانات لوحة القيادة.
 *
 * المبدأ: اللوحة لازم تجاوب على أسئلة إدارية حقيقية، مش تعدّ صفوف. اللوحة القديمة كانت
 * ٥ عدّادات ("1 منتج مسجّل") — معلومة مش بتغيّر أي قرار. الأقسام هنا مرتّبة بترتيب
 * إلحاحها على صاحب الشركة:
 *
 * 1. **محتاج قرارك دلوقتي** — موافقات مستنّية، فواتير فات موعدها، شحنات فيها استثناء.
 * 2. **الفلوس** — مبيعات الشهر، المستحق، المتأخر، صافي الربح.
 * 3. **الاتجاه** — إيراد آخر ٦ شهور، والصفقات حسب المرحلة.
 *
 * ⚠️ كل الاستعلامات متسلسلة مش `Promise.all` — راجع BACKLOG.md (P2028).
 */

export type ActionItem = { label: string; count: number; href: string; tone: "danger" | "warning" | "neutral" };
export type MonthlyRevenue = { month: string; revenue: number };
export type StageCount = { stage: string; count: number };

export type DashboardData = {
  actions: ActionItem[];
  /** مبيعات الشهر الحالي (إيراد مرحَّل بالعملة الوظيفية). */
  revenueThisMonth: Prisma.Decimal;
  /** إجمالي المتبقي على كل الفواتير المُصدَرة غير المسدّدة. */
  outstandingReceivables: Prisma.Decimal;
  /** الجزء المتأخر منه (فات موعد استحقاقه). */
  overdueReceivables: Prisma.Decimal;
  /** صافي الربح من أول السنة. */
  netProfitYtd: Prisma.Decimal;
  currency: string;
  monthlyRevenue: MonthlyRevenue[];
  dealsByStage: StageCount[];
  hasAnyData: boolean;
};

const ZERO = new Prisma.Decimal(0);
const MONTHS_AR = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];

export async function getDashboardData(prisma: ScopedPrismaClient, orgId: string): Promise<DashboardData> {
  const now = new Date();
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const startOfYear = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));

  const org = await prisma.organization.findUniqueOrThrow({ where: { id: orgId }, select: { functionalCurrency: true } });
  const currency = org.functionalCurrency ?? "EGP";

  // ---------- 1) محتاج قرارك ----------
  const pendingApprovals = await prisma.approval.count({ where: { orgId, decision: "Pending" } });

  // "متأخرة" = مُصدَرة/مسدّدة جزئيًا وفات موعد استحقاقها. الحالة Overdue نفسها مش كفاية
  // لوحدها لأنها بتتحدّث بمهمة دورية، والتاريخ هو المصدر الحقيقي.
  const unpaidStatuses: Prisma.InvoiceWhereInput = { status: { in: ["Issued", "PartiallyPaid", "Overdue"] } };
  const overdueInvoices = await prisma.invoice.count({
    where: { orgId, invoiceType: "SalesInvoice", ...unpaidStatuses, dueDate: { lt: now } },
  });

  const openExceptions = await prisma.logisticsException.count({
    where: { orgId, status: { in: ["Open", "InProgress"] }, severity: { in: ["High", "Critical"] } },
  });

  const draftInvoices = await prisma.invoice.count({ where: { orgId, status: "Draft" } });

  const actions: ActionItem[] = ([
    { label: "موافقة مستنّية قرارك", count: pendingApprovals, href: "/approvals", tone: "danger" },
    { label: "فاتورة فات موعد تحصيلها", count: overdueInvoices, href: "/accounting/receivables", tone: "danger" },
    { label: "استثناء لوجستي مفتوح", count: openExceptions, href: "/logistics", tone: "warning" },
    { label: "فاتورة مسودة لسه متصدرتش", count: draftInvoices, href: "/accounting/invoices", tone: "neutral" },
  ] satisfies ActionItem[]).filter((a) => a.count > 0);

  // ---------- 2) الفلوس ----------
  const monthIs = await computeIncomeStatement(prisma, orgId, { from: startOfMonth });
  const ytdIs = await computeIncomeStatement(prisma, orgId, { from: startOfYear });

  const unpaid = await prisma.invoice.findMany({
    where: { orgId, invoiceType: "SalesInvoice", ...unpaidStatuses },
    select: { totalAmount: true, amountPaid: true, dueDate: true },
  });

  let outstandingReceivables = ZERO;
  let overdueReceivables = ZERO;
  for (const inv of unpaid) {
    const remaining = inv.totalAmount.sub(inv.amountPaid);
    if (remaining.lessThanOrEqualTo(0)) continue;
    outstandingReceivables = outstandingReceivables.add(remaining);
    if (inv.dueDate < now) overdueReceivables = overdueReceivables.add(remaining);
  }

  // ---------- 3) الاتجاه ----------
  // إيراد آخر ٦ شهور — استعلام واحد مجمَّع بالشهر بدل ٦ استعلامات منفصلة.
  const sixMonthsAgo = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1));
  const revenueRows = await prisma.$queryRaw<{ month: Date; revenue: Prisma.Decimal }[]>`
    SELECT date_trunc('month', je."entryDate") AS month,
           COALESCE(SUM(jl."functionalCredit" - jl."functionalDebit"), 0) AS revenue
      FROM "JournalLine" jl
      JOIN "JournalEntry" je ON je."id" = jl."journalEntryId"
      JOIN "ChartOfAccount" coa ON coa."id" = jl."accountId"
     WHERE jl."orgId" = ${orgId}::uuid
       AND je."status" IN ('Posted', 'Reversed')
       AND coa."accountType" = 'Revenue'
       AND je."entryDate" >= ${sixMonthsAgo}
     GROUP BY 1
     ORDER BY 1`;

  const revenueByMonth = new Map(revenueRows.map((r) => [`${r.month.getUTCFullYear()}-${r.month.getUTCMonth()}`, Number(r.revenue)]));
  const monthlyRevenue: MonthlyRevenue[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    monthlyRevenue.push({
      month: MONTHS_AR[d.getUTCMonth()],
      revenue: revenueByMonth.get(`${d.getUTCFullYear()}-${d.getUTCMonth()}`) ?? 0,
    });
  }

  const stageGroups = await prisma.opportunity.groupBy({
    by: ["stage"],
    where: { orgId, deletedAt: null },
    _count: { _all: true },
  });
  const dealsByStage: StageCount[] = stageGroups.map((g) => ({ stage: g.stage, count: g._count._all }));

  const hasAnyData =
    monthlyRevenue.some((m) => m.revenue !== 0) || dealsByStage.length > 0 || unpaid.length > 0 || actions.length > 0;

  return {
    actions,
    revenueThisMonth: monthIs.totalRevenue,
    outstandingReceivables,
    overdueReceivables,
    netProfitYtd: ytdIs.netProfit,
    currency,
    monthlyRevenue,
    dealsByStage,
    hasAnyData,
  };
}
