import Link from "next/link";
import { notFound } from "next/navigation";
import { Prisma } from "@/generated/prisma/client";
import { requireCurrentUser } from "@/lib/session";
import { requirePermission } from "@/lib/permissions";
import { getScopedPrisma } from "@/lib/scoped-prisma";
import BankTransactionForm from "./BankTransactionForm";
import BankStatementImportForm from "./BankStatementImportForm";
import BankAccountBankInfoForm from "./BankAccountBankInfoForm";
import BankAccountEditForm from "./BankAccountEditForm";
import { bankTransactionTypeLabel, signedAmount, isInflow } from "@/lib/treasuryLabels";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const dynamic = "force-dynamic";

const zero = () => new Prisma.Decimal(0);

export default async function BankAccountDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireCurrentUser();

  try {
    await requirePermission(user.roleId, "BankAccount", "View");
  } catch {
    return (
      <main className="mx-auto max-w-3xl px-6 py-10">
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-6 text-center text-sm text-destructive">
          معندكش صلاحية الوصول للصفحة دي.
        </div>
      </main>
    );
  }

  const prisma = await getScopedPrisma();
  const account = await prisma.bankAccount.findFirst({ where: { id, orgId: user.orgId } });
  if (!account) notFound();

  const org = await prisma.organization.findUniqueOrThrow({ where: { id: user.orgId }, select: { functionalCurrency: true } });
  const needsFxRate = !!org.functionalCurrency && account.currency !== org.functionalCurrency;

  const transactions = await prisma.bankTransaction.findMany({
    where: { orgId: user.orgId, bankAccountId: id },
    orderBy: [{ transactionDate: "asc" }, { createdAt: "asc" }],
    include: {
      payment: { select: { id: true, paymentNumber: true } },
      reconciliation: { select: { id: true, status: true } },
      journalEntry: { select: { id: true, entryNumber: true } },
      matches: { select: { allocatedAmount: true } },
    },
  });

  // الرصيد الجاري بيتراكم بنفس قاعدة الاتجاه المستخدمة في القاعدة (bank_transaction_signed_amount).
  const rows = transactions.reduce<Array<{ transaction: (typeof transactions)[number]; balance: Prisma.Decimal }>>((acc, t) => {
    const previous = acc.length > 0 ? acc[acc.length - 1].balance : account.openingBalance;
    acc.push({ transaction: t, balance: previous.add(signedAmount(t.transactionType, t.amount)) });
    return acc;
  }, []);
  const currentBalance = rows.length > 0 ? rows[rows.length - 1].balance : account.openingBalance;
  // مطابقة بالمسار السريع (paymentId)، أو بقيد مباشر (journalEntryId)، أو بمضاهاة جزئية
  // اتغطى بيها كامل مبلغ الحركة (BankTransactionMatch.allocatedAmount مجمّعة).
  const isFullyMatched = (t: (typeof transactions)[number]) =>
    Boolean(t.paymentId) || Boolean(t.journalEntryId) || t.matches.reduce((sum, m) => sum.add(m.allocatedAmount), zero()).gte(t.amount);
  const unmatchedCount = transactions.filter((t) => !isFullyMatched(t)).length;

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <Link href="/accounting/bank-accounts" className="text-sm text-muted-foreground hover:underline">
        → كل الحسابات البنكية
      </Link>

      <div className="mt-3 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{account.accountName}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {account.bankName} · {account.currency}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 text-sm">
          <Link href="/accounting/reconciliations" className="text-primary hover:underline">
            المطابقات البنكية ←
          </Link>
          <Link href="/accounting/bank-imports" className="text-primary hover:underline">
            سجل استيراد كشوف الحساب ←
          </Link>
        </div>
      </div>

      <div className="mt-4">
        <BankAccountEditForm bankAccountId={account.id} accountName={account.accountName} bankName={account.bankName} isActive={account.isActive} />
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-xs text-muted-foreground">الرصيد الافتتاحي</p>
          <p className="mt-1 font-mono text-xl font-semibold text-foreground">{account.openingBalance.toFixed(2)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-xs text-muted-foreground">الرصيد الحالي</p>
          <p className="mt-1 font-mono text-2xl font-semibold text-foreground">
            {currentBalance.toFixed(2)} {account.currency}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-xs text-muted-foreground">حركات غير مضاهاة</p>
          <p className={`mt-1 font-mono text-2xl font-semibold ${unmatchedCount > 0 ? "text-amber-700" : "text-emerald-700"}`}>
            {unmatchedCount}
          </p>
        </div>
      </div>

      <div className="mt-6">
        <BankAccountBankInfoForm
          bankAccountId={account.id}
          hasAccountNumber={account.accountNumberSecretId != null}
          hasIban={account.ibanSecretId != null}
          hasSwift={account.swiftSecretId != null}
        />
      </div>

      <div className="mt-6">
        <BankTransactionForm
          bankAccountId={account.id}
          currency={account.currency}
          needsFxRate={needsFxRate}
          functionalCurrency={org.functionalCurrency ?? undefined}
        />
      </div>

      <div className="mt-4">
        <BankStatementImportForm bankAccountId={account.id} />
      </div>

      <h2 className="mt-8 text-lg font-semibold text-foreground">كشف الحساب</h2>
      <div className="mt-2 overflow-x-auto rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>التاريخ</TableHead>
              <TableHead>النوع</TableHead>
              <TableHead>البيان</TableHead>
              <TableHead>وارد</TableHead>
              <TableHead>صادر</TableHead>
              <TableHead>الرصيد</TableHead>
              <TableHead>المضاهاة</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell colSpan={5} className="text-muted-foreground">
                رصيد افتتاحي
              </TableCell>
              <TableCell className="font-mono text-foreground/80">{account.openingBalance.toFixed(2)}</TableCell>
              <TableCell />
            </TableRow>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-6 text-center text-muted-foreground">
                  لسه مفيش حركات على الحساب ده.
                </TableCell>
              </TableRow>
            ) : (
              rows.map(({ transaction: t, balance }) => (
                <TableRow key={t.id}>
                  <TableCell className="text-foreground/80">{t.transactionDate.toISOString().slice(0, 10)}</TableCell>
                  <TableCell className="text-foreground/80">{bankTransactionTypeLabel[t.transactionType]}</TableCell>
                  <TableCell className="text-foreground/80">{t.description ?? t.reference ?? "—"}</TableCell>
                  <TableCell className="font-mono text-emerald-700">{isInflow(t.transactionType) ? t.amount.toFixed(2) : "—"}</TableCell>
                  <TableCell className="font-mono text-rose-700">{isInflow(t.transactionType) ? "—" : t.amount.toFixed(2)}</TableCell>
                  <TableCell className="font-mono font-medium text-foreground">{balance.toFixed(2)}</TableCell>
                  <TableCell>
                    {t.payment ? (
                      <Link href={`/accounting/payments/${t.payment.id}`} className="font-mono text-xs text-primary hover:underline">
                        {t.payment.paymentNumber}
                      </Link>
                    ) : t.journalEntry ? (
                      <Link href={`/accounting/journal-entries/${t.journalEntry.id}`} className="font-mono text-xs text-primary hover:underline">
                        {t.journalEntry.entryNumber}
                      </Link>
                    ) : t.matches.length > 0 ? (
                      <Badge className={isFullyMatched(t) ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100" : "bg-amber-100 text-amber-700 hover:bg-amber-100"}>
                        {isFullyMatched(t) ? "مضاهاة جزئية (مكتملة)" : `مضاهاة جزئية (${t.matches.length})`}
                      </Badge>
                    ) : (
                      <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">غير مضاهاة</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        الحركة غير المضاهاة بند مفتوح — بتظهر كفرق في المطابقة البنكية لحد ما تترّبط بدفعة مسجَّلة أو يترحّل ليها قيد.
      </p>
    </main>
  );
}
