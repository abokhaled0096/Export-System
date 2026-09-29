import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCurrentUser } from "@/lib/session";
import { requirePermission } from "@/lib/permissions";
import { getScopedPrisma } from "@/lib/scoped-prisma";
import ReconciliationWorkspace, { type WorkspaceTransaction, type WorkspacePayment } from "./ReconciliationWorkspace";
import StatementBalanceCard from "./StatementBalanceCard";
import { reconciliationStatusLabel, reconciliationStatusStyle } from "@/lib/treasuryLabels";
import { Badge } from "@/components/ui/badge";
import { formatDate, toDateInputValue } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ReconciliationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireCurrentUser();

  try {
    await requirePermission(user.roleId, "BankReconciliation", "View");
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
  const reconciliation = await prisma.bankReconciliation.findFirst({
    where: { id, orgId: user.orgId },
    include: {
      bankAccount: { select: { id: true, accountName: true, bankName: true, currency: true } },
      reconciledByUser: { select: { fullName: true } },
    },
  });
  if (!reconciliation) notFound();

  // ⚠️ مش Promise.all — راجع BACKLOG.md (P2028).
  const transactions = await prisma.bankTransaction.findMany({
    where: {
      orgId: user.orgId,
      bankAccountId: reconciliation.bankAccountId,
      transactionDate: { lte: reconciliation.statementDate },
    },
    orderBy: [{ transactionDate: "asc" }, { createdAt: "asc" }],
    include: {
      payment: { select: { paymentNumber: true } },
      matches: { include: { payment: { select: { paymentNumber: true } } } },
    },
  });

  // دفعات محصّلة على نفس الحساب لسه من غير حركة بنكية مضاهية (سريعة أو جزئية) — دي
  // المرشّحة للمضاهاة، وغالبًا هي نفسها سبب الفرق بين الكشف والدفتر.
  const unmatchedPayments = await prisma.payment.findMany({
    where: {
      orgId: user.orgId,
      bankAccountId: reconciliation.bankAccountId,
      status: "Cleared",
      bankTransactions: { none: {} },
      bankTransactionMatches: { none: {} },
    },
    orderBy: { paymentDate: "asc" },
    select: { id: true, paymentNumber: true, amount: true, paymentDate: true, direction: true },
  });

  const difference = reconciliation.statementBalance.sub(reconciliation.bookBalance);
  const isClosed = reconciliation.status === "Reconciled";

  const workspaceTransactions: WorkspaceTransaction[] = transactions.map((t) => ({
    id: t.id,
    date: formatDate(t.transactionDate),
    type: t.transactionType,
    amount: t.amount.toFixed(2),
    description: t.description ?? t.reference ?? "—",
    included: t.reconciliationId === reconciliation.id,
    paymentId: t.paymentId,
    paymentNumber: t.payment?.paymentNumber ?? null,
    matches: t.matches.map((m) => ({ id: m.id, paymentNumber: m.payment.paymentNumber, allocatedAmount: m.allocatedAmount.toFixed(2) })),
  }));

  const workspacePayments: WorkspacePayment[] = unmatchedPayments.map((p) => ({
    id: p.id,
    label: `${p.paymentNumber} — ${p.amount.toFixed(2)} (${formatDate(p.paymentDate)})`,
    amount: p.amount.toFixed(2),
  }));

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <Link href="/accounting/reconciliations" className="text-sm text-muted-foreground hover:underline">
        → كل المطابقات
      </Link>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold text-foreground">
          مطابقة {reconciliation.bankAccount.accountName}
        </h1>
        <Badge className={reconciliationStatusStyle[reconciliation.status]}>
          {reconciliationStatusLabel[reconciliation.status]}
        </Badge>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        كشف بتاريخ {formatDate(reconciliation.statementDate)} ·{" "}
        <Link href={`/accounting/bank-accounts/${reconciliation.bankAccount.id}`} className="text-primary hover:underline">
          كشف الحساب الكامل
        </Link>
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <StatementBalanceCard
          reconciliationId={reconciliation.id}
          statementBalance={reconciliation.statementBalance.toFixed(2)}
          statementDate={toDateInputValue(reconciliation.statementDate)}
          notes={reconciliation.notes}
          isClosed={isClosed}
        />
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-xs text-muted-foreground">الرصيد الدفتري (محسوب)</p>
          <p className="mt-1 font-mono text-2xl font-semibold text-foreground">{reconciliation.bookBalance.toFixed(2)}</p>
        </div>
        <div className={`rounded-xl border p-5 ${difference.isZero() ? "border-emerald-300 bg-emerald-50" : "border-rose-300 bg-rose-50"}`}>
          <p className="text-xs text-muted-foreground">الفرق</p>
          <p className={`mt-1 font-mono text-2xl font-semibold ${difference.isZero() ? "text-emerald-700" : "text-rose-700"}`}>
            {difference.toFixed(2)} {reconciliation.bankAccount.currency}
          </p>
        </div>
      </div>

      {isClosed && (
        <p className="mt-4 rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
          مقفولة بمعرفة {reconciliation.reconciledByUser?.fullName ?? "—"} في{" "}
          {formatDate(reconciliation.reconciledAt)} — سجل نهائي مايتعدّلش (أي تصحيح بمطابقة جديدة).
        </p>
      )}

      <ReconciliationWorkspace
        reconciliationId={reconciliation.id}
        transactions={workspaceTransactions}
        openPayments={workspacePayments}
        difference={difference.toFixed(2)}
        isClosed={isClosed}
        currency={reconciliation.bankAccount.currency}
      />
    </main>
  );
}
