import Link from "next/link";
import { requireCurrentUser } from "@/lib/session";
import { requirePermission } from "@/lib/permissions";
import { getScopedPrisma } from "@/lib/scoped-prisma";
import ReconciliationForm, { type AccountOption } from "./ReconciliationForm";
import { reconciliationStatusLabel, reconciliationStatusStyle } from "@/lib/treasuryLabels";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const dynamic = "force-dynamic";

export default async function ReconciliationsPage() {
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

  const orgId = user.orgId;
  const prisma = await getScopedPrisma();

  // ⚠️ مش Promise.all — راجع BACKLOG.md (P2028).
  const reconciliations = await prisma.bankReconciliation.findMany({
    where: { orgId },
    orderBy: { statementDate: "desc" },
    include: { bankAccount: { select: { accountName: true, currency: true } } },
  });
  const accounts = await prisma.bankAccount.findMany({
    where: { orgId, isActive: true },
    orderBy: { accountName: "asc" },
    select: { id: true, accountName: true, bankName: true, currency: true },
  });

  const accountOptions: AccountOption[] = accounts.map((a) => ({
    id: a.id,
    label: `${a.accountName} — ${a.bankName} (${a.currency})`,
  }));

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">المطابقات البنكية</h1>
        <p className="mt-1 text-sm text-muted-foreground">{reconciliations.length} مطابقة</p>
      </div>

      <div className="mt-6">
        <ReconciliationForm accounts={accountOptions} />
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>الحساب</TableHead>
              <TableHead>تاريخ الكشف</TableHead>
              <TableHead>رصيد الكشف</TableHead>
              <TableHead>الرصيد الدفتري</TableHead>
              <TableHead>الفرق</TableHead>
              <TableHead>الحالة</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {reconciliations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-6 text-center text-muted-foreground">
                  لسه مفيش مطابقات بنكية.
                </TableCell>
              </TableRow>
            ) : (
              reconciliations.map((r) => {
                const difference = r.statementBalance.sub(r.bookBalance);
                return (
                  <TableRow key={r.id}>
                    <TableCell>
                      <Link href={`/accounting/reconciliations/${r.id}`} className="text-primary hover:underline">
                        {r.bankAccount.accountName}
                      </Link>
                    </TableCell>
                    <TableCell className="text-foreground/80">{r.statementDate.toISOString().slice(0, 10)}</TableCell>
                    <TableCell className="font-mono text-foreground/80">{r.statementBalance.toFixed(2)}</TableCell>
                    <TableCell className="font-mono text-foreground/80">{r.bookBalance.toFixed(2)}</TableCell>
                    <TableCell className={`font-mono font-semibold ${difference.isZero() ? "text-emerald-700" : "text-rose-700"}`}>
                      {difference.toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <Badge className={reconciliationStatusStyle[r.status]}>{reconciliationStatusLabel[r.status]}</Badge>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </main>
  );
}
