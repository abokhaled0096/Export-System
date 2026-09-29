import Link from "next/link";
import { requireCurrentUser } from "@/lib/session";
import { requirePermission } from "@/lib/permissions";
import { getScopedPrisma } from "@/lib/scoped-prisma";
import InvoiceForm, { type InvoiceFormOption } from "./InvoiceForm";
import { invoiceStatusLabel, invoiceStatusStyle, invoiceTypeLabel, isInvoiceOverdue } from "@/lib/arapLabels";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PAGE_SIZE, parsePage } from "@/lib/pagination";
import Pagination from "@/components/Pagination";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const user = await requireCurrentUser();

  try {
    await requirePermission(user.roleId, "Invoice", "View");
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
  const page = parsePage((await searchParams).page);

  // ⚠️ مش Promise.all — راجع BACKLOG.md (P2028).
  const invoicesWhere = { orgId };
  const invoices = await prisma.invoice.findMany({
    where: invoicesWhere,
    orderBy: { issueDate: "desc" },
    include: { company: { select: { legalName: true } }, supplier: { select: { legalName: true } } },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });
  const totalInvoices = await prisma.invoice.count({ where: invoicesWhere });
  const totalPages = Math.max(1, Math.ceil(totalInvoices / PAGE_SIZE));
  const salesOrders = await prisma.salesOrder.findMany({
    where: { orgId, status: { not: "Cancelled" } },
    orderBy: { soNumber: "desc" },
    select: { id: true, soNumber: true, currency: true, totalValue: true, customerId: true },
  });
  const purchaseOrders = await prisma.purchaseOrder.findMany({
    where: { orgId, status: { not: "Cancelled" } },
    orderBy: { poNumber: "desc" },
    select: { id: true, poNumber: true, currency: true, quantity: true, unitPrice: true, supplierId: true },
  });
  const companies = await prisma.company.findMany({ where: { orgId }, orderBy: { legalName: "asc" }, select: { id: true, legalName: true } });
  const suppliers = await prisma.supplier.findMany({ where: { orgId }, orderBy: { legalName: "asc" }, select: { id: true, legalName: true } });
  const documents = await prisma.document.findMany({
    where: { orgId, etaStatus: "Validated" },
    orderBy: { documentNumber: "desc" },
    select: { id: true, documentNumber: true },
  });

  const soOptions: InvoiceFormOption[] = salesOrders.map((o) => ({
    id: o.id,
    label: `${o.soNumber} — ${o.totalValue.toFixed(2)} ${o.currency}`,
    currency: o.currency,
    total: o.totalValue.toString(),
    companyId: o.customerId,
  }));
  const poOptions: InvoiceFormOption[] = purchaseOrders.map((o) => {
    const total = o.quantity.mul(o.unitPrice);
    return {
      id: o.id,
      label: `${o.poNumber} — ${total.toFixed(2)} ${o.currency}`,
      currency: o.currency,
      total: total.toString(),
      supplierId: o.supplierId,
    };
  });
  const companyOptions: InvoiceFormOption[] = companies.map((c) => ({ id: c.id, label: c.legalName }));
  const supplierOptions: InvoiceFormOption[] = suppliers.map((s) => ({ id: s.id, label: s.legalName }));
  const docOptions: InvoiceFormOption[] = documents.map((d) => ({ id: d.id, label: d.documentNumber }));

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">الفواتير</h1>
          <p className="mt-1 text-sm text-muted-foreground">{totalInvoices} فاتورة</p>
        </div>
        <Link href="/accounting/receivables" className="text-sm text-primary hover:underline">
          تقرير أعمار الديون ←
        </Link>
      </div>

      <div className="mt-6">
        <InvoiceForm salesOrders={soOptions} purchaseOrders={poOptions} companies={companyOptions} suppliers={supplierOptions} documents={docOptions} />
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>الرقم</TableHead>
              <TableHead>النوع</TableHead>
              <TableHead>الطرف</TableHead>
              <TableHead>الإجمالي</TableHead>
              <TableHead>المدفوع</TableHead>
              <TableHead>الاستحقاق</TableHead>
              <TableHead>الحالة</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-6 text-center text-muted-foreground">
                  لسه مفيش فواتير.
                </TableCell>
              </TableRow>
            ) : (
              invoices.map((inv) => {
                const overdue = isInvoiceOverdue(inv.status, inv.dueDate);
                return (
                  <TableRow key={inv.id}>
                    <TableCell>
                      <Link href={`/accounting/invoices/${inv.id}`} className="font-mono text-primary hover:underline">
                        {inv.invoiceNumber}
                      </Link>
                    </TableCell>
                    <TableCell className="text-foreground/80">{invoiceTypeLabel[inv.invoiceType]}</TableCell>
                    <TableCell className="text-foreground/80">{inv.company?.legalName ?? inv.supplier?.legalName ?? "—"}</TableCell>
                    <TableCell className="font-mono text-foreground">
                      {inv.totalAmount.toFixed(2)} {inv.currency}
                    </TableCell>
                    <TableCell className="font-mono text-foreground/80">{inv.amountPaid.toFixed(2)}</TableCell>
                    <TableCell className="text-foreground/80">{formatDate(inv.dueDate)}</TableCell>
                    <TableCell className="flex gap-1.5">
                      <Badge className={invoiceStatusStyle[inv.status]}>{invoiceStatusLabel[inv.status]}</Badge>
                      {overdue && <Badge className={invoiceStatusStyle.Overdue}>متأخرة</Badge>}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
      <Pagination currentPage={page} totalPages={totalPages} basePath="/accounting/invoices" />
    </main>
  );
}
