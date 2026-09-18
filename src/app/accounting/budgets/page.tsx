import { Prisma } from "@/generated/prisma/client";
import { requireCurrentUser } from "@/lib/session";
import { requirePermission } from "@/lib/permissions";
import { getScopedPrisma } from "@/lib/scoped-prisma";
import { BUDGET_TYPE_ACCOUNT_RULES, type BudgetActualRule } from "@/lib/budget";
import BudgetForm, { type PeriodOption, type CostCenterOption } from "./BudgetForm";
import CopyBudgetForm from "./CopyBudgetForm";
import BudgetAmountCell from "./BudgetAmountCell";
import { budgetTypeLabel } from "@/lib/treasuryLabels";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PAGE_SIZE, parsePage } from "@/lib/pagination";
import Pagination from "@/components/Pagination";

export const dynamic = "force-dynamic";

export default async function BudgetsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const user = await requireCurrentUser();

  try {
    await requirePermission(user.roleId, "Budget", "View");
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
  const page = parsePage((await searchParams).page);
  const where = { orgId };

  // ⚠️ مش Promise.all — راجع BACKLOG.md (P2028).
  const budgets = await prisma.budget.findMany({
    where,
    orderBy: [{ period: { startDate: "desc" } }],
    include: { period: { select: { periodName: true } }, costCenter: { select: { code: true, name: true } } },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });
  const total = await prisma.budget.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const periods = await prisma.accountingPeriod.findMany({
    where: { orgId },
    orderBy: { startDate: "desc" },
    select: { id: true, periodName: true },
  });
  const costCenters = await prisma.costCenter.findMany({ where: { orgId }, orderBy: { code: "asc" }, select: { id: true, code: true, name: true } });

  // كل بنود الدفتر المرحّلة لكل الفترات المستخدمة في الموازنات — مجمّعة في الذاكرة (نفس أسلوب
  // تقرير أعمار الذمم وشاشة الـ13 أسبوع، بيانات محدودة النطاق مناسبة للتجميع في JS).
  const periodIds = [...new Set(budgets.map((b) => b.periodId))];
  const lines =
    periodIds.length > 0
      ? await prisma.journalLine.findMany({
          where: { orgId, journalEntry: { periodId: { in: periodIds }, status: { in: ["Posted", "Reversed"] } } },
          select: {
            debit: true,
            credit: true,
            costCenterId: true,
            journalEntry: { select: { periodId: true } },
            account: { select: { accountType: true, accountCode: true } },
          },
        })
      : [];

  function matchesRule(rule: BudgetActualRule, line: (typeof lines)[number]): boolean {
    if ("accountType" in rule) return line.account.accountType === rule.accountType;
    // بالإضافة للكود نفسه، لازم يشمل أي حساب فرعي منه (1010-USD تحت 1010) — نفس منطق
    // computeBudgetActual في lib/budget.ts، وإلا الرقم المعروض هنا يختلف عن رقم التنبيه الفعلي.
    return rule.accountCodes.some((code) => line.account.accountCode === code || line.account.accountCode.startsWith(`${code}-`));
  }

  function actualFor(periodId: string, costCenterId: string | null, budgetType: string): Prisma.Decimal {
    const rule = BUDGET_TYPE_ACCOUNT_RULES[budgetType];
    if (!rule) return new Prisma.Decimal(0);

    let total = new Prisma.Decimal(0);
    for (const line of lines) {
      if (line.journalEntry.periodId !== periodId) continue;
      if (costCenterId && line.costCenterId !== costCenterId) continue;
      if (!matchesRule(rule, line)) continue;

      total = rule.direction === "debit" ? total.add(line.debit).sub(line.credit) : total.add(line.credit).sub(line.debit);
    }
    return total;
  }

  const periodOptions: PeriodOption[] = periods.map((p) => ({ id: p.id, label: p.periodName }));
  const costCenterOptions: CostCenterOption[] = costCenters.map((c) => ({ id: c.id, label: `${c.code} — ${c.name}` }));

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">الموازنات — موازنة مقابل فعلي</h1>
        <p className="mt-1 text-sm text-muted-foreground">{total} بند — الفعلي محسوب من الدفتر مباشرة</p>
      </div>

      <div className="mt-6 flex flex-col gap-4">
        <BudgetForm periods={periodOptions} costCenters={costCenterOptions} />
        <CopyBudgetForm periods={periodOptions} />
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>الفترة</TableHead>
              <TableHead>النوع</TableHead>
              <TableHead>مركز التكلفة</TableHead>
              <TableHead>الموازنة</TableHead>
              <TableHead>الفعلي</TableHead>
              <TableHead>الانحراف</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {budgets.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-6 text-center text-muted-foreground">
                  لسه مفيش بنود موازنة مسجّلة.
                </TableCell>
              </TableRow>
            ) : (
              budgets.map((b) => {
                const actual = actualFor(b.periodId, b.costCenterId, b.budgetType);
                const variance = b.amount.sub(actual);
                const overBudget = variance.lt(0);
                return (
                  <TableRow key={b.id}>
                    <TableCell className="text-foreground/80">{b.period.periodName}</TableCell>
                    <TableCell className="text-foreground/80">{budgetTypeLabel[b.budgetType]}</TableCell>
                    <TableCell className="text-foreground/80">{b.costCenter ? `${b.costCenter.code} — ${b.costCenter.name}` : "على مستوى المنظمة"}</TableCell>
                    <TableCell>
                      <BudgetAmountCell budgetId={b.id} amount={b.amount.toFixed(2)} currency={b.currency} />
                    </TableCell>
                    <TableCell className="font-mono text-foreground">{actual.toFixed(2)}</TableCell>
                    <TableCell className={`font-mono font-semibold ${overBudget ? "text-rose-700" : "text-emerald-700"}`}>
                      {overBudget ? "تجاوز " : "متبقي "}
                      {variance.abs().toFixed(2)}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        الفعلي بيتحسب من حركة الدفتر الحقيقية (القيود المرحّلة) بمركز التكلفة والفترة المطابقين — مش رقم يُكتب. بند بلا مركز تكلفة بيجمع حركة المنظمة كلها.
      </p>
      <Pagination currentPage={page} totalPages={totalPages} basePath="/accounting/budgets" />
    </main>
  );
}
