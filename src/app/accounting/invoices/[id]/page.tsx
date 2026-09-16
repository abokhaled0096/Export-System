import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCurrentUser } from "@/lib/session";
import { requirePermission } from "@/lib/permissions";
import { getScopedPrisma } from "@/lib/scoped-prisma";
import InvoiceActions from "./InvoiceActions";
import LinkDocumentForm, { type DocumentOption } from "./LinkDocumentForm";
import {
  invoiceStatusLabel,
  invoiceStatusStyle,
  invoiceTypeLabel,
  isInvoiceOverdue,
  daysOverdue,
  paymentStatusLabel,
} from "@/lib/arapLabels";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const dynamic = "force-dynamic";

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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

  const prisma = await getScopedPrisma();
  const invoice = await prisma.invoice.findFirst({
    where: { id, orgId: user.orgId },
    include: {
      company: { select: { legalName: true } },
      supplier: { select: { legalName: true } },
      salesOrder: { select: { id: true, soNumber: true } },
      document: { select: { documentNumber: true, etaStatus: true } },
      journalEntry: { select: { id: true, entryNumber: true, status: true } },
      allocations: {
        include: { payment: { select: { id: true, paymentNumber: true, status: true, paymentDate: true } } },
      },
    },
  });
  if (!invoice) notFound();

  const org = await prisma.organization.findUniqueOrThrow({ where: { id: user.orgId }, select: { functionalCurrency: true } });
  const needsFxRate = !!org.functionalCurrency && invoice.currency !== org.functionalCurrency;

  // ⚠️ مش Promise.all — راجع BACKLOG.md (P2028).
  const validatedDocuments =
    invoice.invoiceType === "SalesInvoice" && invoice.status === "Draft" && !invoice.documentId
      ? await prisma.document.findMany({
          where: { orgId: user.orgId, etaStatus: "Validated" },
          orderBy: { documentNumber: "desc" },
          select: { id: true, documentNumber: true },
        })
      : [];
  const documentOptions: DocumentOption[] = validatedDocuments.map((d) => ({ id: d.id, label: d.documentNumber }));

  const remaining = invoice.totalAmount.sub(invoice.amountPaid);
  const overdue = isInvoiceOverdue(invoice.status, invoice.dueDate);

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <Link href="/accounting/invoices" className="text-sm text-muted-foreground hover:underline">
        → كل الفواتير
      </Link>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <h1 className="font-mono text-2xl font-semibold text-foreground">{invoice.invoiceNumber}</h1>
        <Badge className={invoiceStatusStyle[invoice.status]}>{invoiceStatusLabel[invoice.status]}</Badge>
        {overdue && <Badge className={invoiceStatusStyle.Overdue}>متأخرة {daysOverdue(invoice.dueDate)} يوم</Badge>}
      </div>

      <dl className="mt-6 grid gap-4 rounded-xl border border-border bg-card p-5 sm:grid-cols-3">
        <div>
          <dt className="text-xs text-muted-foreground">النوع</dt>
          <dd className="text-foreground">{invoiceTypeLabel[invoice.invoiceType]}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">الطرف</dt>
          <dd className="text-foreground">{invoice.company?.legalName ?? invoice.supplier?.legalName ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">أمر البيع</dt>
          <dd className="text-foreground">{invoice.salesOrder?.soNumber ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">الصافي</dt>
          <dd className="font-mono text-foreground">{invoice.subtotal.toFixed(2)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">الضريبة</dt>
          <dd className="font-mono text-foreground">{invoice.taxAmount.toFixed(2)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">الإجمالي</dt>
          <dd className="font-mono text-lg font-semibold text-foreground">
            {invoice.totalAmount.toFixed(2)} {invoice.currency}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">المدفوع</dt>
          <dd className="font-mono text-emerald-700">{invoice.amountPaid.toFixed(2)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">المتبقي</dt>
          <dd className="font-mono font-semibold text-foreground">{remaining.toFixed(2)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">الاستحقاق</dt>
          <dd className="text-foreground">{invoice.dueDate.toISOString().slice(0, 10)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">المستند الإلكتروني</dt>
          <dd className="text-foreground">
            {invoice.document ? `${invoice.document.documentNumber} (${invoice.document.etaStatus})` : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">القيد المحاسبي</dt>
          <dd className="text-foreground">
            {invoice.journalEntry ? (
              <Link href={`/accounting/journal-entries/${invoice.journalEntry.id}`} className="font-mono text-primary hover:underline">
                {invoice.journalEntry.entryNumber}
              </Link>
            ) : (
              "— لسه متصدرش —"
            )}
          </dd>
        </div>
      </dl>

      {invoice.notes && (
        <div className="mt-4 rounded-xl border border-border bg-card px-4 py-3 text-sm">
          <p className="text-xs text-muted-foreground">ملاحظات</p>
          <p className="mt-1 whitespace-pre-wrap text-foreground/80">{invoice.notes}</p>
        </div>
      )}

      {invoice.invoiceType === "SalesInvoice" && invoice.status === "Draft" && !invoice.document && (
        <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3">
          <p className="text-sm text-amber-800">
            ⚠️ فاتورة المبيعات مش هتتصدر من غير مستند إلكتروني معتمد من مصلحة الضرائب (ETA) — ده قيد قانوني مفروض على مستوى قاعدة البيانات.
          </p>
          <div className="mt-3">
            <LinkDocumentForm invoiceId={invoice.id} documents={documentOptions} />
          </div>
        </div>
      )}

      <div className="mt-5">
        <InvoiceActions
          invoiceId={invoice.id}
          status={invoice.status}
          needsFxRate={needsFxRate}
          functionalCurrency={org.functionalCurrency ?? undefined}
          currency={invoice.currency}
        />
      </div>

      <h2 className="mt-8 text-lg font-semibold text-foreground">الدفعات المخصَّصة</h2>
      <div className="mt-2 overflow-x-auto rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>رقم الدفعة</TableHead>
              <TableHead>التاريخ</TableHead>
              <TableHead>المبلغ المخصَّص</TableHead>
              <TableHead>حالة الدفعة</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoice.allocations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-6 text-center text-muted-foreground">
                  مفيش دفعات مخصَّصة على الفاتورة دي.
                </TableCell>
              </TableRow>
            ) : (
              invoice.allocations.map((a) => (
                <TableRow key={a.id}>
                  <TableCell>
                    <Link href={`/accounting/payments/${a.payment.id}`} className="font-mono text-primary hover:underline">
                      {a.payment.paymentNumber}
                    </Link>
                  </TableCell>
                  <TableCell className="text-foreground/80">{a.payment.paymentDate.toISOString().slice(0, 10)}</TableCell>
                  <TableCell className="font-mono text-foreground">{a.allocatedAmount.toFixed(2)}</TableCell>
                  <TableCell className="text-foreground/80">{paymentStatusLabel[a.payment.status]}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        المدفوع بيتحسب من الدفعات المحصّلة بس (Cleared) — الدفعة المعلّقة أو المرتدّة مش بتقلّل رصيد الفاتورة.
      </p>
    </main>
  );
}
