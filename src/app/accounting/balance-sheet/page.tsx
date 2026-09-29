import Link from "next/link";
import { requireCurrentUser } from "@/lib/session";
import { requirePermission } from "@/lib/permissions";
import { getScopedPrisma } from "@/lib/scoped-prisma";
import { computeBalanceSheet, type StatementLine } from "@/lib/financialStatements";
import { Prisma } from "@/generated/prisma/client";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { formatDate, toDateInputValue } from "@/lib/format";

export const dynamic = "force-dynamic";

function Section({
  title,
  lines,
  total,
  currency,
  extra,
}: {
  title: string;
  lines: StatementLine[];
  total: Prisma.Decimal;
  currency: string;
  extra?: { label: string; amount: Prisma.Decimal; hint: string };
}) {
  return (
    <>
      <TableRow className="bg-muted/40">
        <TableCell colSpan={2} className="font-medium text-foreground">
          {title}
        </TableCell>
      </TableRow>
      {lines.length === 0 && !extra ? (
        <TableRow>
          <TableCell colSpan={2} className="ps-8 text-muted-foreground">
            مفيش أرصدة
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
      {extra && (
        <TableRow>
          <TableCell className="ps-8 text-foreground/80">
            {extra.label}
            <span className="block text-[11px] text-muted-foreground">{extra.hint}</span>
          </TableCell>
          <TableCell className="text-end font-mono text-foreground/80">{extra.amount.toFixed(2)}</TableCell>
        </TableRow>
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

export default async function BalanceSheetPage({ searchParams }: { searchParams: Promise<{ asOf?: string }> }) {
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

  const { asOf } = await searchParams;
  const prisma = await getScopedPrisma();

  // تاريخ غير صالح في الـURL بيرجّع لليوم بدل ما يرمي Invalid Date على طول الصفحة.
  const parsed = asOf ? new Date(`${asOf}T23:59:59.999Z`) : null;
  const asOfDate = parsed && !Number.isNaN(parsed.getTime()) ? parsed : new Date();
  // الاتنين مختلفين عن قصد: `<input type="date">` بيفهم yyyy-mm-dd بس، والعنوان بيتقري dd/mm/yyyy.
  const asOfInputValue = toDateInputValue(asOfDate);
  const asOfLabel = formatDate(asOfDate);

  // ⚠️ مش Promise.all — راجع BACKLOG.md (P2028).
  const org = await prisma.organization.findUniqueOrThrow({ where: { id: user.orgId }, select: { functionalCurrency: true } });
  const sheet = await computeBalanceSheet(prisma, user.orgId, asOfDate);

  const currency = org.functionalCurrency ?? "EGP";

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">الميزانية العمومية</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            كما في {asOfLabel} · بالعملة الوظيفية ({currency}) · القيود المرحّلة بس
          </p>
        </div>
        {sheet.isBalanced ? (
          <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">✓ متزنة</Badge>
        ) : (
          <Badge className="bg-rose-100 text-rose-700 hover:bg-rose-100">⚠ غير متزنة</Badge>
        )}
      </div>

      <form className="mt-4 flex flex-wrap items-end gap-2" action="/accounting/balance-sheet">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="asOf" className="text-xs text-muted-foreground">
            كما في تاريخ
          </label>
          <input
            id="asOf"
            name="asOf"
            type="date"
            defaultValue={asOfInputValue}
            className="h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:border-primary focus:outline-none"
          />
        </div>
        <button
          type="submit"
          className="h-9 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          عرض
        </button>
      </form>

      <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-card">
        <Table>
          <TableBody>
            <Section title="الأصول" lines={sheet.assets} total={sheet.totalAssets} currency={currency} />
            <Section title="الخصوم" lines={sheet.liabilities} total={sheet.totalLiabilities} currency={currency} />
            <Section
              title="حقوق الملكية"
              lines={sheet.equity}
              total={sheet.totalEquity}
              currency={currency}
              extra={{
                label: "أرباح الفترة (غير مقفولة)",
                amount: sheet.retainedEarnings,
                hint: "إيرادات − تكلفة مبيعات − مصروفات، لحد التاريخ ده. بتتحوّل لحساب أرباح مُرحَّلة بقيد الإقفال السنوي.",
              }}
            />
            <TableRow className="border-t-2 border-border bg-muted/60">
              <TableCell className="text-base font-semibold text-foreground">إجمالي الخصوم وحقوق الملكية</TableCell>
              <TableCell className="text-end font-mono text-base font-semibold text-foreground">
                {sheet.totalLiabilitiesAndEquity.toFixed(2)} {currency}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>

      {!sheet.isBalanced && (
        <div className="mt-4 rounded-xl border border-rose-300 bg-rose-50 px-4 py-3">
          <p className="text-sm text-rose-800">
            ⚠️ الميزانية مش متزنة بفرق{" "}
            <span className="font-mono font-semibold">
              {sheet.difference.toFixed(2)} {currency}
            </span>
            . الأصول لازم تساوي الخصوم + حقوق الملكية بالظبط. الأسباب المحتملة: حساب نوعه غلط في شجرة الحسابات، أو قيد فيه
            حساب اتمسح. راجع{" "}
            <Link href="/accounting/trial-balance" className="underline">
              ميزان المراجعة
            </Link>{" "}
            و
            <Link href="/accounting/chart-of-accounts" className="underline">
              شجرة الحسابات
            </Link>
            .
          </p>
        </div>
      )}

      <p className="mt-4 text-xs text-muted-foreground">
        أرصدة تراكمية من أول النشاط لحد التاريخ المحدّد (مش لفترة واحدة — ده الفرق عن قائمة الدخل). الحسابات اللي رصيدها صفر
        مش ظاهرة.
      </p>
    </main>
  );
}
