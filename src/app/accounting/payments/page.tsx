import Link from "next/link";
import { requireCurrentUser } from "@/lib/session";
import { requirePermission } from "@/lib/permissions";
import { getScopedPrisma } from "@/lib/scoped-prisma";
import PaymentForm, { type PaymentOption } from "./PaymentForm";
import { paymentDirectionLabel, paymentMethodLabel, paymentStatusLabel, paymentStatusStyle } from "@/lib/arapLabels";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const dynamic = "force-dynamic";

export default async function PaymentsPage() {
  const user = await requireCurrentUser();

  try {
    await requirePermission(user.roleId, "Payment", "View");
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
  const payments = await prisma.payment.findMany({
    where: { orgId },
    orderBy: { paymentDate: "desc" },
    include: {
      company: { select: { legalName: true } },
      supplier: { select: { legalName: true } },
      bankAccount: { select: { accountName: true } },
    },
  });
  const bankAccounts = await prisma.bankAccount.findMany({
    where: { orgId, isActive: true },
    orderBy: { accountName: "asc" },
    select: { id: true, accountName: true, bankName: true, currency: true },
  });
  const companies = await prisma.company.findMany({ where: { orgId }, orderBy: { legalName: "asc" }, select: { id: true, legalName: true } });
  const suppliers = await prisma.supplier.findMany({ where: { orgId }, orderBy: { legalName: "asc" }, select: { id: true, legalName: true } });

  const bankOptions: PaymentOption[] = bankAccounts.map((b) => ({
    id: b.id,
    label: `${b.accountName} — ${b.bankName} (${b.currency})`,
    currency: b.currency,
  }));

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">الدفعات</h1>
        <p className="mt-1 text-sm text-muted-foreground">{payments.length} دفعة</p>
      </div>

      <div className="mt-6">
        <PaymentForm
          bankAccounts={bankOptions}
          companies={companies.map((c) => ({ id: c.id, label: c.legalName }))}
          suppliers={suppliers.map((s) => ({ id: s.id, label: s.legalName }))}
        />
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>الرقم</TableHead>
              <TableHead>الاتجاه</TableHead>
              <TableHead>الطرف</TableHead>
              <TableHead>المبلغ</TableHead>
              <TableHead>الطريقة</TableHead>
              <TableHead>الحساب البنكي</TableHead>
              <TableHead>التاريخ</TableHead>
              <TableHead>الحالة</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-6 text-center text-muted-foreground">
                  لسه مفيش دفعات.
                </TableCell>
              </TableRow>
            ) : (
              payments.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <Link href={`/accounting/payments/${p.id}`} className="font-mono text-primary hover:underline">
                      {p.paymentNumber}
                    </Link>
                  </TableCell>
                  <TableCell className="text-foreground/80">{paymentDirectionLabel[p.direction]}</TableCell>
                  <TableCell className="text-foreground/80">{p.company?.legalName ?? p.supplier?.legalName ?? "—"}</TableCell>
                  <TableCell className="font-mono text-foreground">
                    {p.amount.toFixed(2)} {p.currency}
                  </TableCell>
                  <TableCell className="text-foreground/80">{paymentMethodLabel[p.paymentMethod]}</TableCell>
                  <TableCell className="text-foreground/80">{p.bankAccount.accountName}</TableCell>
                  <TableCell className="text-foreground/80">{p.paymentDate.toISOString().slice(0, 10)}</TableCell>
                  <TableCell>
                    <Badge className={paymentStatusStyle[p.status]}>{paymentStatusLabel[p.status]}</Badge>
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
