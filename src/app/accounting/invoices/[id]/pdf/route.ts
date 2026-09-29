import { NextResponse } from "next/server";
import { getScopedPrisma } from "@/lib/scoped-prisma";
import { requireCurrentUser } from "@/lib/session";
import { requirePermission } from "@/lib/permissions";
import { renderInvoicePdf, type InvoicePdfData, type InvoicePdfLine } from "@/lib/invoice-pdf";
import { amountToArabicWords } from "@/lib/numberToArabicWords";
import { Prisma } from "@/generated/prisma/client";

// توليد PDF بـChromium (cold start + رندر) ممكن ياخد أكتر من الـ10 ثواني الافتراضية على Vercel
// Hobby — بلا الحد الأقصى ده، أول طلب بعد فترة خمول ممكن يترفض بـTimeout قبل ما Chromium يخلّص.
export const maxDuration = 60;

const TYPE_LABELS: Record<string, { ar: string; en: string }> = {
  SalesInvoice: { ar: "فاتورة تجارية", en: "Commercial Invoice" },
  PurchaseInvoice: { ar: "فاتورة مشتريات", en: "Purchase Invoice" },
  CreditNote: { ar: "إشعار خصم", en: "Credit Note" },
  DebitNote: { ar: "إشعار إضافة", en: "Debit Note" },
  ProformaInvoice: { ar: "فاتورة مبدئية", en: "Proforma Invoice" },
};

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireCurrentUser();

  try {
    await requirePermission(user.roleId, "Invoice", "View");
  } catch {
    return new NextResponse("معندكش صلاحية الوصول للفاتورة دي", { status: 403 });
  }

  const prisma = await getScopedPrisma();
  const invoice = await prisma.invoice.findFirst({
    where: { id, orgId: user.orgId },
    include: {
      company: { select: { legalName: true, country: true } },
      supplier: { select: { legalName: true, country: true } },
      document: { select: { documentNumber: true } },
      salesOrder: { select: { soNumber: true, incoterm: true, paymentTerms: true } },
      organization: { select: { legalName: true, taxId: true } },
      lines: { orderBy: { lineNumber: "asc" } },
    },
  });
  if (!invoice) return new NextResponse("الفاتورة غير موجودة", { status: 404 });

  const ZERO = new Prisma.Decimal(0);
  const sumWeights = (key: "netWeightKg" | "grossWeightKg") =>
    invoice.lines.reduce((t, l) => (l[key] ? t.add(l[key]!) : t), ZERO);
  const netWeight = sumWeights("netWeightKg");
  const grossWeight = sumWeights("grossWeightKg");

  const lines: InvoicePdfLine[] = invoice.lines.map((l) => ({
    lineNumber: l.lineNumber,
    description: l.description,
    hsCode: l.hsCode,
    countryOfOrigin: l.countryOfOrigin,
    quantity: l.quantity.toFixed(3),
    unit: l.unit,
    unitPrice: l.unitPrice.toFixed(4),
    lineTotal: l.lineTotal.toFixed(2),
    netWeightKg: l.netWeightKg?.toFixed(3) ?? null,
    grossWeightKg: l.grossWeightKg?.toFixed(3) ?? null,
  }));

  const typeLabel = TYPE_LABELS[invoice.invoiceType] ?? { ar: invoice.invoiceType, en: invoice.invoiceType };

  const data: InvoicePdfData = {
    orgLegalName: invoice.organization.legalName,
    orgTaxId: invoice.organization.taxId,
    invoiceNumber: invoice.invoiceNumber,
    invoiceTypeAr: typeLabel.ar,
    invoiceTypeEn: typeLabel.en,
    status: invoice.status,
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate,
    currency: invoice.currency,
    subtotal: invoice.subtotal.toFixed(2),
    taxAmount: invoice.taxAmount.toFixed(2),
    totalAmount: invoice.totalAmount.toFixed(2),
    totalInWords: amountToArabicWords(invoice.totalAmount, invoice.currency),
    partyName: invoice.company?.legalName ?? invoice.supplier?.legalName ?? "—",
    partyCountry: invoice.company?.country ?? invoice.supplier?.country ?? null,
    incoterm: invoice.salesOrder?.incoterm ?? null,
    namedPlace: null,
    paymentTerms: invoice.salesOrder?.paymentTerms ?? null,
    soNumber: invoice.salesOrder?.soNumber ?? null,
    etaDocumentNumber: invoice.document?.documentNumber ?? null,
    notes: invoice.notes,
    lines,
    totalNetWeight: netWeight.greaterThan(0) ? netWeight.toFixed(3) : null,
    totalGrossWeight: grossWeight.greaterThan(0) ? grossWeight.toFixed(3) : null,
  };

  const pdf = await renderInvoicePdf(data);
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${invoice.invoiceNumber}.pdf"`,
    },
  });
}
