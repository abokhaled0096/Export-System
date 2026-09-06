import Link from "next/link";
import { requireCurrentUser } from "@/lib/session";
import { requirePermission } from "@/lib/permissions";
import { getScopedPrisma } from "@/lib/scoped-prisma";
import BankAccountForm from "./BankAccountForm";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const dynamic = "force-dynamic";

export default async function BankAccountsPage() {
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
  const records = await prisma.bankAccount.findMany({
    where: { orgId: user.orgId },
    orderBy: { accountName: "asc" },
  });

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">الحسابات البنكية</h1>
          <p className="mt-1 text-sm text-muted-foreground">{records.length} حساب مسجّل</p>
        </div>
        <Link href="/accounting/bank-imports" className="text-sm text-primary hover:underline">
          سجل استيراد كشوف الحساب ←
        </Link>
      </div>

      <div className="mt-6">
        <BankAccountForm />
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>اسم الحساب</TableHead>
              <TableHead>البنك</TableHead>
              <TableHead>العملة</TableHead>
              <TableHead>الرصيد الافتتاحي</TableHead>
              <TableHead>الحالة</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-6 text-center text-muted-foreground">
                  لسه مفيش حسابات بنكية مسجّلة.
                </TableCell>
              </TableRow>
            ) : (
              records.map((a) => (
                <TableRow key={a.id}>
                  <TableCell>
                    <Link href={`/accounting/bank-accounts/${a.id}`} className="text-primary hover:underline">
                      {a.accountName}
                    </Link>
                  </TableCell>
                  <TableCell className="text-foreground/80">{a.bankName}</TableCell>
                  <TableCell className="font-mono text-foreground/80">{a.currency}</TableCell>
                  <TableCell className="font-mono text-foreground/80">{a.openingBalance.toFixed(2)}</TableCell>
                  <TableCell>
                    <Badge
                      className={
                        a.isActive
                          ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100"
                          : "bg-secondary text-secondary-foreground hover:bg-secondary"
                      }
                    >
                      {a.isActive ? "نشط" : "موقوف"}
                    </Badge>
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
