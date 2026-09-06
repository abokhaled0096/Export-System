import { Prisma } from "@/generated/prisma/client";
import type { getScopedPrisma, ScopedTx } from "./scoped-prisma";
import type { QuotePdfData } from "./quote-pdf";

type Client = Awaited<ReturnType<typeof getScopedPrisma>> | ScopedTx;

/** يجيب كل بيانات الـQuote المطلوبة لتوليد الـPDF/الإيميل في استعلام واحد — مُستخدَم من route الـPDF ومن sendQuoteEmail. */
export async function getQuotePdfData(prisma: Client, quoteId: string, orgId: string): Promise<QuotePdfData | null> {
  const quote = await prisma.quote.findFirst({
    where: { id: quoteId, orgId },
    include: {
      customer: true,
      scenario: true,
      deal: {
        include: {
          product: true,
          market: true,
          organization: true,
          opportunity: { include: { contact: true } },
        },
      },
    },
  });
  if (!quote) return null;

  const totalValue = new Prisma.Decimal(quote.unitPrice).mul(quote.scenario.quantitySaleable);

  return {
    orgLegalName: quote.deal.organization.legalName,
    orgTaxId: quote.deal.organization.taxId,
    quoteId: quote.id,
    version: quote.version,
    status: quote.status,
    createdAt: quote.createdAt,
    validUntil: quote.validUntil,
    currency: quote.currency,
    incoterm: quote.incoterm,
    namedPlace: quote.namedPlace,
    unitPrice: quote.unitPrice.toString(),
    priceUnit: quote.priceUnit,
    paymentTerms: quote.scenario.paymentTerms,
    quantitySaleable: quote.scenario.quantitySaleable.toString(),
    totalValue: totalValue.toString(),
    productNameAr: quote.deal.product.nameAr,
    productNameEn: quote.deal.product.nameEn,
    hsCode: quote.deal.product.hsCode,
    marketCountryAr: quote.deal.market.countryNameAr,
    customerLegalName: quote.customer.legalName,
    customerCountry: quote.customer.country,
    customerCity: quote.customer.city,
    contactName: quote.deal.opportunity.contact?.name ?? null,
  };
}
