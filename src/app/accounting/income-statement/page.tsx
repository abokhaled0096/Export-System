import Link from "next/link";
import { requireCurrentUser } from "@/lib/session";
import { requirePermission } from "@/lib/permissions";
import { getScopedPrisma } from "@/lib/scoped-prisma";
import { computeIncomeStatement, type StatementLine } from "@/lib/financialStatements";
import { Prisma } from "@/generated/prisma/client";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";

export const dynamic = "force-dynamic";

function Section({ title, lines, total, currency }: { title: string; lines: StatementLine[]; total: Prisma.Decimal; currency: string }) {
  return (
    <>
      <TableRow className="bg-muted/40">
        <TableCell colSpan={2} className="font-medium text-foreground">
          {title}
        </TableCell>
      </TableRow>
      {lines.length === 0 ? (
        <TableRow>
          <TableCell colSpan={2} className="ps-8 text-muted-foreground">
            مفيش حركة
          </TableCell>
        </TableRow>
      ) : (
        lines.map((l) => (
          <TableRow key={l.accountId}>
            <TableCell className="ps-8 text-foreground/80">
              <span className="font-mono text-xs text-muted-foreground">{l.accountCode}</span> {l.nameAr}
            </TableCell>
            <TableCell className="text-end font-mono text-foreground/80">{l.amount.toFixed(2)}</TableCell>
          </TableRow>
        ))
      )}
      <TableRow>
        <TableCell className="ps-8 font-medium text-foreground">إجمالي {title}</TableCell>
        <TableCell className="text-end font-mono font-medium text-foreground">
          {total.toFixed(2)} {currency}
        </TableCell>
      </TableRow>
    </>
  );
}

function ResultRow({ label, value, currency, strong }: { label: string; value: Prisma.Decimal; currency: string; strong?: boolean }) {
  // الأحمر للخسارة والأخضر للربح — دلالة، مش لون علامة تجارية.
  const tone = value.isNegative() ? "text-rose-700" : "text-emerald-700";
  return (
    <TableRow className={strong ? "border-t-2 border-border bg-muted/60" : "bg-muted/20"}>
      <TableCell className={strong ? "text-base font-semibold text-foreground" : "font-medium text-foreground"}>{label}</TableCell>
      <TableCell className={`text-end font-mono ${strong ? "text-base font-semibold" : "font-medium"} ${tone}`}>
        {value.toFixed(2)} {currency}
      </TableCell>
    </TableRow>
  );
}

export default async function IncomeStatementPage({ searchParams }: { searchParams: Promise<{ periodId?: string }> }) {
  const user = await requireCurrentUser();

  try {
    await requirePermission(user.roleId, "JournalEntry", "View");
  } catch {
    return (
      <main className="mx-auto max-w-3xl px-6 py-10">
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-6 text-center text-sm text-destructive">
          معندكش صلاحية الوصول للصفحة دي — متاحة لدور Finance/Admin/CompanyOwner.
        </div>
      </main>
    );
  }

  const { periodId } = await searchParams;
  const prisma = await getScopedPrisma();

  // ⚠️ مش Promise.all — راجع BACKLOG.md (P2028).
  const org = await prisma.organization.findUniqueOrThrow({ where: { id: user.orgId }, select: { functionalCurrency: true } });
  const periods = await prisma.accountingPeriod.findMany({
    where: { orgId: user.orgId },
    select: { id: true, periodName: true },
    orderBy: { startDate: "desc" },
  });
  const statement = await computeIncomeStatement(prisma, user.orgId, { periodId });

  const currency = org.functionalCurrency ?? "EGP";
  const periodName = periodId ? (periods.find((p) => p.id === periodId)?.periodName ?? "—") : "كل الفترات";

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">قائمة الدخل</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {periodName} · بالعملة الوظيفية ({currency}) · القيود المرحّلة بس
        </p>
      </div>

      {periods.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button
            nativeButton={false}
            variant={!periodId ? "default" : "outline"}
            size="sm"
            render={<Link href="/accounting/income-statement">كل الفترات</Link>}
          />
          {periods.map((p) => (
            <Button
              key={p.id}
              nativeButton={false}
              variant={periodId === p.id ? "default" : "outline"}
              size="sm"
              render={<Link href={`/accounting/income-statement?periodId=${p.id}`}>{p.periodName}</Link>}
            />
          ))}
        </div>
      )}

      <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-card">
        <Table>
          <TableBody>
            <Section title="الإيرادات" lines={statement.revenue} total={statement.totalRevenue} currency={currency} />
            <Section title="تكلفة المبيعات" lines={statement.cogs} total={statement.totalCogs} currency={currency} />
            <ResultRow label="مجمل الربح" value={statement.grossProfit} currency={currency} />
            <Section title="المصروفات" lines={statement.expenses} total={statement.totalExpenses} currency={currency} />
            <ResultRow label="صافي الربح" value={statement.netProfit} currency={currency} strong />
          </TableBody>
        </Table>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-card px-4 py-3">
          <p className="text-xs text-muted-foreground">هامش مجمل الربح</p>
          <p className="mt-1 font-mono text-lg text-foreground">
            {statement.grossMarginPct ? `${statement.grossMarginPct.toFixed(2)}%` : "—"}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card px-4 py-3">
          <p className="text-xs text-muted-foreground">هامش صافي الربح</p>
          <p className="mt-1 font-mono text-lg text-foreground">
            {statement.netMarginPct ? `${statement.netMarginPct.toFixed(2)}%` : "—"}
          </p>
        </div>
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        الأرقام محسوبة من القيود اليومية المرحّلة مباشرة (بما فيها القيود المعكوسة وعكسها، لأن صافي أثرهم صفر). الحسابات اللي
        رصيدها صفر مش ظاهرة. للتفاصيل سطر بسطر، راجع{" "}
        <Link href="/accounting/trial-balance" className="text-primary hover:underline">
          ميزان المراجعة
        </Link>
        .
      </p>
    </main>
  );
}
