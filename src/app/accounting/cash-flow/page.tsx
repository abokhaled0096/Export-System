import Link from "next/link";
import { Prisma } from "@/generated/prisma/client";
import { requireCurrentUser } from "@/lib/session";
import { requirePermission } from "@/lib/permissions";
import { getScopedPrisma } from "@/lib/scoped-prisma";
import CashFlowLineForm from "./CashFlowLineForm";
import {
  cashFlowCategoryLabel,
  MANUAL_CASH_FLOW_CATEGORIES,
  isCashOutflowCategory,
  thirteenWeeksFrom,
  weekKey,
  mondayOf,
  signedAmount,
} from "@/lib/treasuryLabels";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const dynamic = "force-dynamic";

type Search = Promise<{ currency?: string }>;

const zero = () => new Prisma.Decimal(0);

export default async function CashFlowPage({ searchParams }: { searchParams: Search }) {
  const { currency: selectedCurrency } = await searchParams;
  const user = await requireCurrentUser();

  try {
    await requirePermission(user.roleId, "CashFlowForecastLine", "View");
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

  // ⚠️ مش Promise.all — راجع BACKLOG.md (P2028).
  const accounts = await prisma.bankAccount.findMany({
    where: { orgId, isActive: true },
    select: { id: true, currency: true, openingBalance: true },
  });

  const currencies = [...new Set(accounts.map((a) => a.currency))].sort();
  // ⚠️ الشاشة بعملة واحدة — جمع تدفّقات بعملات مختلفة بلا سعر صرف بيدّي رقم وهمي،
  // نفس قاعدة منع القيود متعددة العملات المفروضة على مستوى القاعدة في دفتر الأستاذ.
  const currency = selectedCurrency && currencies.includes(selectedCurrency) ? selectedCurrency : currencies[0];

  if (!currency) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-10">
        <h1 className="text-2xl font-semibold text-foreground">التدفّق النقدي — 13 أسبوع</h1>
        <p className="mt-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          لازم تضيف حساب بنكي واحد على الأقل عشان الشاشة دي تشتغل.
        </p>
      </main>
    );
  }

  const accountsInCurrency = accounts.filter((a) => a.currency === currency);
  const accountIds = accountsInCurrency.map((a) => a.id);

  const weeks = thirteenWeeksFrom(new Date());
  const horizonStart = weeks[0];
  const horizonEnd = new Date(weeks[12]);
  horizonEnd.setUTCDate(horizonEnd.getUTCDate() + 7);

  // الرصيد الافتتاحي الحقيقي = أرصدة الحسابات دلوقتي (افتتاحي + كل الحركات لحد بداية الأفق).
  const transactionsToDate = await prisma.bankTransaction.findMany({
    where: { orgId, bankAccountId: { in: accountIds }, transactionDate: { lt: horizonStart } },
    select: { transactionType: true, amount: true },
  });
  let openingCash = accountsInCurrency.reduce((sum, a) => sum.add(a.openingBalance), zero());
  for (const t of transactionsToDate) openingCash = openingCash.add(signedAmount(t.transactionType, t.amount));

  // المتوقّع من النظام: فواتير مستحقة في الأسبوع + أقساط قروض مستحقة فيه.
  const openInvoices = await prisma.invoice.findMany({
    where: {
      orgId,
      currency,
      status: { in: ["Issued", "PartiallyPaid"] },
      dueDate: { gte: horizonStart, lt: horizonEnd },
    },
    select: { invoiceType: true, dueDate: true, totalAmount: true, amountPaid: true },
  });
  const pendingInstallments = await prisma.loanInstallment.findMany({
    where: { orgId, status: "Pending", dueDate: { gte: horizonStart, lt: horizonEnd }, loan: { currency } },
    select: { dueDate: true, principalPortion: true, interestPortion: true },
  });
  const manualLines = await prisma.cashFlowForecastLine.findMany({
    where: { orgId, currency, weekStartDate: { gte: horizonStart, lt: horizonEnd } },
    select: { weekStartDate: true, category: true, amount: true, notes: true },
  });
  // الفعلي: الدفعات المحصّلة فعلًا في الأسبوع — مشتق من الدفتر، مش مكتوب بإيد.
  const clearedPayments = await prisma.payment.findMany({
    where: {
      orgId,
      currency,
      status: "Cleared",
      paymentDate: { gte: horizonStart, lt: horizonEnd },
    },
    select: { direction: true, paymentDate: true, amount: true },
  });

  type Cell = { projected: Prisma.Decimal; manual: Prisma.Decimal; actual: Prisma.Decimal; notes: string[] };
  const grid = new Map<string, Map<string, Cell>>();
  for (const w of weeks) {
    const row = new Map<string, Cell>();
    for (const c of MANUAL_CASH_FLOW_CATEGORIES) row.set(c, { projected: zero(), manual: zero(), actual: zero(), notes: [] });
    grid.set(weekKey(w), row);
  }

  function cell(date: Date, category: string): Cell | undefined {
    return grid.get(weekKey(mondayOf(date)))?.get(category);
  }

  for (const inv of openInvoices) {
    const remaining = inv.totalAmount.sub(inv.amountPaid);
    if (remaining.lte(0)) continue;
    const category = inv.invoiceType === "SalesInvoice" ? "CustomerCollections" : "SupplierPayments";
    const c = cell(inv.dueDate, category);
    if (c) c.projected = c.projected.add(remaining);
  }
  for (const inst of pendingInstallments) {
    const c = cell(inst.dueDate, "LoanService");
    if (c) c.projected = c.projected.add(inst.principalPortion.add(inst.interestPortion));
  }
  for (const line of manualLines) {
    const c = cell(line.weekStartDate, line.category);
    if (c) {
      c.manual = c.manual.add(line.amount);
      if (line.notes) c.notes.push(line.notes);
    }
  }
  for (const p of clearedPayments) {
    const category = p.direction === "Inbound" ? "CustomerCollections" : "SupplierPayments";
    const c = cell(p.paymentDate, category);
    if (c) c.actual = c.actual.add(p.amount);
  }

  // صافي الأسبوع = المتوقّع + اليدوي، بإشارة الفئة. الفعلي بيتعرض للمقارنة مش للتراكم،
  // عشان ما نجمعش نفس الحدث مرتين (المتوقّع بيتحقق كفعلي، مش بيتضاف عليه).
  const weekly = weeks.map((w) => {
    const row = grid.get(weekKey(w))!;
    let net = zero();
    let actualNet = zero();
    for (const c of MANUAL_CASH_FLOW_CATEGORIES) {
      const v = row.get(c)!;
      const combined = v.projected.add(v.manual);
      net = isCashOutflowCategory(c) ? net.sub(combined) : net.add(combined);
      actualNet = isCashOutflowCategory(c) ? actualNet.sub(v.actual) : actualNet.add(v.actual);
    }
    return { week: w, row, net, actualNet };
  });

  let runningBalance = openingCash;
  const withBalances = weekly.map((w) => {
    const opening = runningBalance;
    runningBalance = runningBalance.add(w.net);
    return { ...w, opening, closing: runningBalance };
  });

  const lowestWeek = withBalances.reduce((lowest, w) => (w.closing.lt(lowest.closing) ? w : lowest), withBalances[0]);
  const weekOptions = weeks.map((w) => weekKey(w));

  return (
    <main className="mx-auto max-w-[1400px] px-6 py-10">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">التدفّق النقدي — 13 أسبوع</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            من {weekKey(weeks[0])} لـ {weekKey(weeks[12])} · {accountsInCurrency.length} حساب بعملة {currency}
          </p>
        </div>
        {currencies.length > 1 && (
          <div className="flex gap-2">
            {currencies.map((c) => (
              <Link
                key={c}
                href={`/accounting/cash-flow?currency=${c}`}
                className={`rounded-lg border px-3 py-1.5 text-sm ${
                  c === currency ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-secondary"
                }`}
              >
                {c}
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-xs text-muted-foreground">الرصيد النقدي الحالي</p>
          <p className="mt-1 font-mono text-2xl font-semibold text-foreground">
            {openingCash.toFixed(2)} {currency}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-xs text-muted-foreground">الرصيد المتوقّع بعد 13 أسبوع</p>
          <p className={`mt-1 font-mono text-2xl font-semibold ${runningBalance.lt(0) ? "text-rose-700" : "text-foreground"}`}>
            {runningBalance.toFixed(2)}
          </p>
        </div>
        <div className={`rounded-xl border p-5 ${lowestWeek.closing.lt(0) ? "border-rose-300 bg-rose-50" : "border-border bg-card"}`}>
          <p className="text-xs text-muted-foreground">أدنى رصيد متوقّع</p>
          <p className={`mt-1 font-mono text-2xl font-semibold ${lowestWeek.closing.lt(0) ? "text-rose-700" : "text-foreground"}`}>
            {lowestWeek.closing.toFixed(2)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">أسبوع {weekKey(lowestWeek.week)}</p>
        </div>
      </div>

      <div className="mt-6">
        <CashFlowLineForm weeks={weekOptions} currency={currency} />
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="sticky right-0 bg-card">الأسبوع</TableHead>
              <TableHead>الافتتاحي</TableHead>
              {MANUAL_CASH_FLOW_CATEGORIES.map((c) => (
                <TableHead key={c}>{cashFlowCategoryLabel[c]}</TableHead>
              ))}
              <TableHead>الصافي</TableHead>
              <TableHead>الختامي</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {withBalances.map((w) => (
              <TableRow key={weekKey(w.week)}>
                <TableCell className="sticky right-0 bg-card font-mono text-xs text-foreground">{weekKey(w.week)}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{w.opening.toFixed(2)}</TableCell>
                {MANUAL_CASH_FLOW_CATEGORIES.map((c) => {
                  const v = w.row.get(c)!;
                  const combined = v.projected.add(v.manual);
                  const hasActual = !v.actual.isZero();
                  return (
                    <TableCell key={c} className="font-mono text-xs">
                      {combined.isZero() && !hasActual && v.notes.length === 0 ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <div className="flex flex-col leading-tight">
                          <span className={isCashOutflowCategory(c) ? "text-rose-700" : "text-foreground"}>
                            {combined.toFixed(2)}
                          </span>
                          {hasActual && <span className="text-[10px] text-emerald-700">فعلي {v.actual.toFixed(2)}</span>}
                          {(!v.manual.isZero() || v.notes.length > 0) && (
                            <span className="text-[10px] text-sky-700">
                              {!v.manual.isZero() && `يدوي ${v.manual.toFixed(2)}`}
                              {v.notes.length > 0 && (
                                <span title={v.notes.join(" | ")} className="ms-1 cursor-help">
                                  📝
                                </span>
                              )}
                            </span>
                          )}
                        </div>
                      )}
                    </TableCell>
                  );
                })}
                <TableCell className={`font-mono text-xs font-medium ${w.net.lt(0) ? "text-rose-700" : "text-emerald-700"}`}>
                  {w.net.toFixed(2)}
                </TableCell>
                <TableCell className={`font-mono text-xs font-semibold ${w.closing.lt(0) ? "text-rose-700" : "text-foreground"}`}>
                  {w.closing.toFixed(2)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        الرقم الأساسي في كل خانة = متوقّع النظام (فواتير مستحقة + أقساط) + التوقّع اليدوي. &quot;فعلي&quot; مشتق من الدفعات المحصّلة —
        مش مكتوب بإيد، عشان رقم فعلي مكتوب يدويًا رقم مخترع. الرصيد الافتتاحي/الختامي محسوبان تراكميًا من أرصدة الحسابات الحقيقية.
      </p>
    </main>
  );
}
