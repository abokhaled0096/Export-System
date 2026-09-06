import Link from "next/link";
import { notFound } from "next/navigation";
import { Prisma } from "@/generated/prisma/client";
import { requireCurrentUser } from "@/lib/session";
import { requirePermission } from "@/lib/permissions";
import { getScopedPrisma } from "@/lib/scoped-prisma";
import PaymentActions from "./PaymentActions";
import AllocationForm, { type OpenInvoiceOption } from "./AllocationForm";
import { paymentDirectionLabel, paymentMethodLabel, paymentStatusLabel, paymentStatusStyle } from "@/lib/arapLabels";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const dynamic = "force-dynamic";

export default async function PaymentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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

  const prisma = await getScopedPrisma();
  const payment = await prisma.payment.findFirst({
    where: { id, orgId: user.orgId },
    include: {
      company: { select: { legalName: true } },
      supplier: { select: { legalName: true } },
      bankAccount: { select: { accountName: true, bankName: true } },
      journalEntry: { select: { id: true, entryNumber: true } },
      allocations: { include: { invoice: { select: { id: true, invoiceNumber: true, totalAmount: true, amountPaid: true } } } },
    },
  });
  if (!payment) notFound();

  const allocated = payment.allocations.reduce((sum, a) => sum.add(a.allocatedAmount), new Prisma.Decimal(0));
  const unallocated = payment.amount.sub(allocated);

  // فواتير مفتوحة بنفس العملة والاتجاه — التخصيص عابر العملات ممنوع بـTrigger أصلًا،
  // فبنفلتره من القائمة عشان المستخدم ميوصلش لرسالة خطأ كان ممكن يتجنبها.
  const allocatedIds = payment.allocations.map((a) => a.invoiceId);
  const openInvoices = await prisma.invoice.findMany({
    where: {
      orgId: user.orgId,
      currency: payment.currency,
      status: { in: ["Issued", "PartiallyPaid"] },
      invoiceType: payment.direction === "Inbound" ? "SalesInvoice" : "PurchaseInvoice",
      id: { notIn: allocatedIds.length > 0 ? allocatedIds : undefined },
    },
    orderBy: { dueDate: "asc" },
    select: { id: true, invoiceNumber: true, totalAmount: true, amountPaid: true },
  });

  const invoiceOptions: OpenInvoiceOption[] = openInvoices.map((i) => ({
    id: i.id,
    label: `${i.invoiceNumber} — متبقي ${i.totalAmount.sub(i.amountPaid).toFixed(2)} ${payment.currency}`,
  }));

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <Link href="/accounting/payments" className="text-sm text-muted-foreground hover:underline">
        → كل الدفعات
      </Link>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <h1 className="font-mono text-2xl font-semibold text-foreground">{payment.paymentNumber}</h1>
        <Badge className={paymentStatusStyle[payment.status]}>{paymentStatusLabel[payment.status]}</Badge>
      </div>

      <dl className="mt-6 grid gap-4 rounded-xl border border-border bg-card p-5 sm:grid-cols-3">
        <div>
          <dt className="text-xs text-muted-foreground">الاتجاه</dt>
          <dd className="text-foreground">{paymentDirectionLabel[payment.direction]}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">الطرف</dt>
          <dd className="text-foreground">{payment.company?.legalName ?? payment.supplier?.legalName ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">الحساب البنكي</dt>
          <dd className="text-foreground">
            {payment.bankAccount.accountName} — {payment.bankAccount.bankName}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">المبلغ</dt>
          <dd className="font-mono text-lg font-semibold text-foreground">
            {payment.amount.toFixed(2)} {payment.currency}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">المخصَّص</dt>
          <dd className="font-mono text-foreground">{allocated.toFixed(2)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">غير المخصَّص</dt>
          <dd className="font-mono font-semibold text-foreground">{unallocated.toFixed(2)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">الطريقة</dt>
          <dd className="text-foreground">{paymentMethodLabel[payment.paymentMethod]}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">التاريخ</dt>
          <dd className="text-foreground">{payment.paymentDate.toISOString().slice(0, 10)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">المرجع</dt>
          <dd className="text-foreground">{payment.reference ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">القيد المحاسبي</dt>
          <dd className="text-foreground">
            {payment.journalEntry ? (
              <Link href={`/accounting/journal-entries/${payment.journalEntry.id}`} className="font-mono text-primary hover:underline">
                {payment.journalEntry.entryNumber}
              </Link>
            ) : (
              "— لسه متحصّلتش —"
            )}
          </dd>
        </div>
      </dl>

      <div className="mt-5">
        <PaymentActions paymentId={payment.id} status={payment.status} direction={payment.direction} />
      </div>

      <h2 className="mt-8 text-lg font-semibold text-foreground">تخصيص الدفعة على الفواتير</h2>
      <div className="mt-2">
        <AllocationForm paymentId={payment.id} invoices={invoiceOptions} unallocated={unallocated.toFixed(2)} />
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>الفاتورة</TableHead>
              <TableHead>إجمالي الفاتورة</TableHead>
              <TableHead>المبلغ المخصَّص</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payment.allocations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="py-6 text-center text-muted-foreground">
                  الدفعة لسه متخصّصتش على أي فاتورة.
                </TableCell>
              </TableRow>
            ) : (
              payment.allocations.map((a) => (
                <TableRow key={a.id}>
                  <TableCell>
                    <Link href={`/accounting/invoices/${a.invoice.id}`} className="font-mono text-primary hover:underline">
                      {a.invoice.invoiceNumber}
                    </Link>
                  </TableCell>
                  <TableCell className="font-mono text-foreground/80">{a.invoice.totalAmount.toFixed(2)}</TableCell>
                  <TableCell className="font-mono text-foreground">{a.allocatedAmount.toFixed(2)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </main>
  );
}
