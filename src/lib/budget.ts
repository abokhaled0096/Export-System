import { Prisma } from "@/generated/prisma/client";
import type { AccountType } from "@/generated/prisma/enums";
import type { ScopedTx } from "./scoped-prisma";
import { GL_ACCOUNTS } from "./glAccounts";
import { budgetTypeLabel } from "./treasuryLabels";
import { notifyBudgetExceeded } from "./notification";

/** خريطة نوع الموازنة → الحسابات المعنية واتجاه الحركة الطبيعي لها — نفس القاعدة المستخدمة في
 * src/app/accounting/budgets/page.tsx (مصدر واحد، عشان صفحة العرض وفحص التنبيه هنا ما يختلفوش). */
export type BudgetActualRule = { direction: "debit" | "credit" } & ({ accountType: AccountType } | { accountCodes: string[] });

export const BUDGET_TYPE_ACCOUNT_RULES: Record<string, BudgetActualRule> = {
  Sales: { accountType: "Revenue", direction: "credit" },
  Purchase: { accountType: "COGS", direction: "debit" },
  OPEX: { accountType: "Expense", direction: "debit" },
  CAPEX: { accountCodes: [GL_ACCOUNTS.FIXED_ASSETS_COST], direction: "debit" },
  Cash: { accountCodes: [GL_ACCOUNTS.CASH], direction: "debit" },
};

/** بيحسب "الفعلي" لبند موازنة من الدفتر مباشرة (استعلام DB لبند واحد، بيدعم استبعاد قيد بعينه —
 * لازمة لمقارنة قبل/بعد وقت الترحيل في checkBudgetAlerts تحت). */
export async function computeBudgetActual(
  tx: ScopedTx,
  params: { orgId: string; periodId: string; costCenterId: string | null; budgetType: string; excludeJournalEntryId?: string }
): Promise<Prisma.Decimal> {
  const rule = BUDGET_TYPE_ACCOUNT_RULES[params.budgetType];
  if (!rule) return new Prisma.Decimal(0);

  const lines = await tx.journalLine.findMany({
    where: {
      orgId: params.orgId,
      journalEntry: {
        periodId: params.periodId,
        status: { in: ["Posted", "Reversed"] },
        ...(params.excludeJournalEntryId ? { id: { not: params.excludeJournalEntryId } } : {}),
      },
      ...(params.costCenterId ? { costCenterId: params.costCenterId } : {}),
      account:
        "accountType" in rule
          ? { accountType: rule.accountType }
          : {
              // بالإضافة للكود نفسه، لازم يشمل أي حساب فرعي منه (زي 1010-USD تحت 1010 —
              // راجع resolveCashAccountId في accounting.ts)، وإلا صرف حسابات النقدية الفرعية
              // بعملة أجنبية بيفضل غير مرئي لموازنة النقدية وتنبيه التجاوز ميطلعش.
              OR: rule.accountCodes.flatMap((code) => [{ accountCode: code }, { accountCode: { startsWith: `${code}-` } }]),
            },
    },
    select: { debit: true, credit: true },
  });

  return lines.reduce(
    (total, l) => (rule.direction === "debit" ? total.add(l.debit).sub(l.credit) : total.add(l.credit).sub(l.debit)),
    new Prisma.Decimal(0)
  );
}

/** بيتنادى من postJournalEntryById بعد ترحيل أي قيد — نقطة الوصل الوحيدة لكل مسارات الترحيل في
 * المنظومة (يدوي أو آلي). بيقارن "الفعلي" قبل وبعد القيد ده لكل بند موازنة ممكن يكون اتأثر
 * (نفس الفترة + مركز تكلفة القيد أو بند بلا مركز تكلفة يجمع المنظمة كلها) — لو الفعلي عدّى
 * الموازنة بسبب القيد ده تحديدًا (كان ≤ قبله، بقى > بعده)، يبعت إشعار. لو كان متجاوز أصلًا،
 * مفيش إشعار تاني — تجنّب إزعاج متكرر بلا عمود "تم التنبيه" مخزَّن. */
export async function checkBudgetAlerts(
  tx: ScopedTx,
  params: { orgId: string; periodId: string; journalEntryId: string }
): Promise<void> {
  // فحص وجود رخيص أولًا (indexed بـperiodId) — الأغلبية الساحقة من الترحيلات في فترات بلا أي
  // بند موازنة خالص، فمفيش داعي نستعلم JournalLine (مراكز التكلفة) لكل ترحيل في المنظومة كلها
  // لو أصلًا مفيش بند موازنة ممكن يتأثر (تكلفة إضافية على أكتر دالة ترحيل مركزية في النظام).
  const hasAnyBudget = await tx.budget.findFirst({ where: { orgId: params.orgId, periodId: params.periodId }, select: { id: true } });
  if (!hasAnyBudget) return;

  const touchedCostCenters = await tx.journalLine.findMany({
    where: { journalEntryId: params.journalEntryId, costCenterId: { not: null } },
    select: { costCenterId: true },
    distinct: ["costCenterId"],
  });
  const costCenterIds = touchedCostCenters.map((l) => l.costCenterId as string);

  const candidateBudgets = await tx.budget.findMany({
    where: {
      orgId: params.orgId,
      periodId: params.periodId,
      OR: [{ costCenterId: null }, ...(costCenterIds.length ? [{ costCenterId: { in: costCenterIds } }] : [])],
    },
    include: { period: { select: { periodName: true } }, costCenter: { select: { name: true } } },
  });

  for (const budget of candidateBudgets) {
    // Await متتالي عمدًا — استعلامين على نفس الـtransaction interactive بيتصفوا فعليًا عند
    // Prisma بغض النظر، فـPromise.all هنا بيزوّد التعقيد بلا أي فايدة توازي حقيقية.
    const before = await computeBudgetActual(tx, {
      orgId: params.orgId,
      periodId: params.periodId,
      costCenterId: budget.costCenterId,
      budgetType: budget.budgetType,
      excludeJournalEntryId: params.journalEntryId,
    });
    const after = await computeBudgetActual(tx, { orgId: params.orgId, periodId: params.periodId, costCenterId: budget.costCenterId, budgetType: budget.budgetType });
    const justCrossed = before.lte(budget.amount) && after.gt(budget.amount);
    if (!justCrossed) continue;

    await notifyBudgetExceeded(tx, {
      orgId: params.orgId,
      budgetId: budget.id,
      budgetTypeLabel: budgetTypeLabel[budget.budgetType] ?? budget.budgetType,
      costCenterLabel: budget.costCenter?.name ?? "على مستوى المنظمة",
      periodName: budget.period.periodName,
      amount: budget.amount.toString(),
      actual: after.toString(),
    });
  }
}
