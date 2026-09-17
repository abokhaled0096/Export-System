import Link from "next/link";
import { notFound } from "next/navigation";
import { Prisma } from "@/generated/prisma/client";
import { requireCurrentUser } from "@/lib/session";
import { requirePermission } from "@/lib/permissions";
import { getScopedPrisma } from "@/lib/scoped-prisma";
import { DisburseButton, MarkDefaultedButton, PayInstallmentButton, InstallmentForm, GenerateScheduleButton } from "./LoanActions";
import { loanStatusLabel, loanStatusStyle, loanInstallmentStatusLabel, isInstallmentOverdue } from "@/lib/treasuryLabels";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const dynamic = "force-dynamic";

export default async function LoanDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireCurrentUser();

  try {
    await requirePermission(user.roleId, "Loan", "View");
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
  const loan = await prisma.loan.findFirst({
    where: { id, orgId: user.orgId },
    include: {
      bankAccount: { select: { id: true, accountName: true } },
      journalEntry: { select: { id: true, entryNumber: true } },
      installments: {
        orderBy: { dueDate: "asc" },
        include: {
          payment: { select: { id: true, paymentNumber: true } },
          journalEntry: { select: { id: true, entryNumber: true } },
        },
      },
    },
  });
  if (!loan) notFound();

  const scheduledPrincipal = loan.installments.reduce((sum, i) => sum.add(i.principalPortion), new Prisma.Decimal(0));
  const unscheduled = loan.principal.sub(scheduledPrincipal);
  const totalInterest = loan.installments.reduce((sum, i) => sum.add(i.interestPortion), new Prisma.Decimal(0));

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <Link href="/accounting/loans" className="text-sm text-muted-foreground hover:underline">
        → كل القروض
      </Link>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold text-foreground">{loan.lenderName}</h1>
        <Badge className={loanStatusStyle[loan.status]}>{loanStatusLabel[loan.status]}</Badge>
        {!loan.disbursedAt && <Badge className="bg-secondary text-secondary-foreground hover:bg-secondary">لسه متصرفش</Badge>}
      </div>

      <dl className="mt-6 grid gap-4 rounded-xl border border-border bg-card p-5 sm:grid-cols-3">
        <div>
          <dt className="text-xs text-muted-foreground">أصل القرض</dt>
          <dd className="font-mono text-lg font-semibold text-foreground">
            {loan.principal.toFixed(2)} {loan.currency}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">المتبقي من الأصل</dt>
          <dd className="font-mono text-lg font-semibold text-foreground">{loan.outstandingPrincipal.toFixed(2)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">إجمالي فوائد الجدول</dt>
          <dd className="font-mono text-foreground">{totalInterest.toFixed(2)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">الحساب البنكي</dt>
          <dd className="text-foreground">
            <Link href={`/accounting/bank-accounts/${loan.bankAccount.id}`} className="text-primary hover:underline">
              {loan.bankAccount.accountName}
            </Link>
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">سعر الفائدة (سنوي)</dt>
          <dd className="font-mono text-foreground">{loan.interestRatePct ? `${loan.interestRatePct.toFixed(3)}%` : "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">طريقة التقسيط</dt>
          <dd className="text-foreground">
            {loan.amortizationMethod === "EqualInstallment"
              ? `قسط ثابت — ${loan.numberOfInstallments} قسط`
              : loan.amortizationMethod === "EqualPrincipal"
                ? `أصل ثابت — ${loan.numberOfInstallments} قسط`
                : "غير محدَّدة (جدول يدوي)"}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">الضمان</dt>
          <dd className="text-foreground">{loan.collateral ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">البداية</dt>
          <dd className="text-foreground">{loan.startDate.toISOString().slice(0, 10)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">الاستحقاق النهائي</dt>
          <dd className="text-foreground">{loan.maturityDate.toISOString().slice(0, 10)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">قيد الصرف</dt>
          <dd className="text-foreground">
            {loan.journalEntry ? (
              <Link href={`/accounting/journal-entries/${loan.journalEntry.id}`} className="font-mono text-primary hover:underline">
                {loan.journalEntry.entryNumber}
              </Link>
            ) : (
              "— لسه متصرفش —"
            )}
          </dd>
        </div>
      </dl>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <DisburseButton loanId={loan.id} disbursed={Boolean(loan.disbursedAt)} />
        {loan.status === "Active" && loan.disbursedAt && <MarkDefaultedButton loanId={loan.id} lenderName={loan.lenderName} />}
      </div>

      <h2 className="mt-8 text-lg font-semibold text-foreground">جدول الأقساط</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        أصل مجدول {scheduledPrincipal.toFixed(2)} من {loan.principal.toFixed(2)} — غير مجدول {unscheduled.toFixed(2)}
      </p>

      {loan.status === "Active" && loan.installments.length === 0 && loan.numberOfInstallments && loan.amortizationMethod && (
        <div className="mt-3">
          <GenerateScheduleButton loanId={loan.id} />
        </div>
      )}

      {loan.status === "Active" && (
        <div className="mt-3">
          <InstallmentForm loanId={loan.id} currency={loan.currency} />
        </div>
      )}

      <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>الاستحقاق</TableHead>
              <TableHead>الأصل</TableHead>
              <TableHead>الفوائد</TableHead>
              <TableHead>الإجمالي</TableHead>
              <TableHead>الحالة</TableHead>
              <TableHead>الدفعة</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loan.installments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-6 text-center text-muted-foreground">
                  لسه مفيش أقساط مجدولة.
                </TableCell>
              </TableRow>
            ) : (
              loan.installments.map((i) => {
                const overdue = isInstallmentOverdue(i.status, i.dueDate);
                return (
                  <TableRow key={i.id}>
                    <TableCell className="text-foreground/80">{i.dueDate.toISOString().slice(0, 10)}</TableCell>
                    <TableCell className="font-mono text-foreground">{i.principalPortion.toFixed(2)}</TableCell>
                    <TableCell className="font-mono text-foreground/80">{i.interestPortion.toFixed(2)}</TableCell>
                    <TableCell className="font-mono font-medium text-foreground">
                      {i.principalPortion.add(i.interestPortion).toFixed(2)}
                    </TableCell>
                    <TableCell className="flex gap-1.5">
                      <Badge
                        className={
                          i.status === "Paid"
                            ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100"
                            : "bg-secondary text-secondary-foreground hover:bg-secondary"
                        }
                      >
                        {loanInstallmentStatusLabel[i.status]}
                      </Badge>
                      {overdue && <Badge className="bg-rose-100 text-rose-700 hover:bg-rose-100">متأخر</Badge>}
                    </TableCell>
                    <TableCell>
                      {i.payment ? (
                        <Link href={`/accounting/payments/${i.payment.id}`} className="font-mono text-xs text-primary hover:underline">
                          {i.payment.paymentNumber}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>
                      {i.status === "Pending" && loan.disbursedAt && <PayInstallmentButton installmentId={i.id} />}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        السداد بينشئ دفعة صادرة حقيقية وحركة بنكية وقيد مرحّل — مش مجرد تغيير حالة. &quot;متأخر&quot; محسوب وقت العرض، مش مخزَّن.
      </p>
    </main>
  );
}
