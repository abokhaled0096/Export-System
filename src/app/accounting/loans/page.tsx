import Link from "next/link";
import { requireCurrentUser } from "@/lib/session";
import { requirePermission } from "@/lib/permissions";
import { getScopedPrisma } from "@/lib/scoped-prisma";
import LoanForm, { type LoanAccountOption } from "./LoanForm";
import { loanStatusLabel, loanStatusStyle } from "@/lib/treasuryLabels";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const dynamic = "force-dynamic";

export default async function LoansPage() {
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

  const orgId = user.orgId;
  const prisma = await getScopedPrisma();

  // ⚠️ مش Promise.all — راجع BACKLOG.md (P2028).
  const loans = await prisma.loan.findMany({
    where: { orgId },
    orderBy: { startDate: "desc" },
    include: { bankAccount: { select: { accountName: true } }, _count: { select: { installments: true } } },
  });
  const accounts = await prisma.bankAccount.findMany({
    where: { orgId, isActive: true },
    orderBy: { accountName: "asc" },
    select: { id: true, accountName: true, bankName: true, currency: true },
  });

  const accountOptions: LoanAccountOption[] = accounts.map((a) => ({
    id: a.id,
    label: `${a.accountName} — ${a.bankName} (${a.currency})`,
  }));

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">القروض</h1>
        <p className="mt-1 text-sm text-muted-foreground">{loans.length} قرض</p>
      </div>

      <div className="mt-6">
        <LoanForm accounts={accountOptions} />
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>الجهة المقرضة</TableHead>
              <TableHead>الحساب</TableHead>
              <TableHead>الأصل</TableHead>
              <TableHead>المتبقي</TableHead>
              <TableHead>الاستحقاق</TableHead>
              <TableHead>الأقساط</TableHead>
              <TableHead>الحالة</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loans.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-6 text-center text-muted-foreground">
                  لسه مفيش قروض مسجّلة.
                </TableCell>
              </TableRow>
            ) : (
              loans.map((l) => (
                <TableRow key={l.id}>
                  <TableCell>
                    <Link href={`/accounting/loans/${l.id}`} className="text-primary hover:underline">
                      {l.lenderName}
                    </Link>
                  </TableCell>
                  <TableCell className="text-foreground/80">{l.bankAccount.accountName}</TableCell>
                  <TableCell className="font-mono text-foreground/80">
                    {l.principal.toFixed(2)} {l.currency}
                  </TableCell>
                  <TableCell className="font-mono font-semibold text-foreground">{l.outstandingPrincipal.toFixed(2)}</TableCell>
                  <TableCell className="text-foreground/80">{l.maturityDate.toISOString().slice(0, 10)}</TableCell>
                  <TableCell className="text-foreground/80">{l._count.installments}</TableCell>
                  <TableCell className="flex gap-1.5">
                    <Badge className={loanStatusStyle[l.status]}>{loanStatusLabel[l.status]}</Badge>
                    {!l.disbursedAt && (
                      <Badge className="bg-secondary text-secondary-foreground hover:bg-secondary">لسه متصرفش</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </main>
  );
}
