import type { getScopedPrisma, ScopedTx } from "./scoped-prisma";
import type { QuoteBundlePdfData } from "./quote-pdf";

type Client = Awaited<ReturnType<typeof getScopedPrisma>> | ScopedTx;

/** يجيب كل بيانات حزمة عروض الأسعار المطلوبة لتوليد PDF واحد مجمَّع — نفس نمط getQuotePdfData
 * بس لمستند بيغطّي أكتر من Quote/Deal مستقل. */
export async function getQuoteBundlePdfData(prisma: Client, bundleId: string, orgId: string): Promise<QuoteBundlePdfData | null> {
  const bundle = await prisma.quoteBundle.findFirst({
    where: { id: bundleId, orgId },
    include: {
      customer: true,
      quotes: {
        include: {
          deal: { include: { product: true, market: true, organization: true, opportunity: { include: { contact: true } } } },
          scenario: true,
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!bundle || bundle.quotes.length === 0) return null;

  const firstDeal = bundle.quotes[0].deal;

  return {
    orgLegalName: firstDeal.organization.legalName,
    orgTaxId: firstDeal.organization.taxId,
    bundleId: bundle.id,
    createdAt: bundle.createdAt,
    customerLegalName: bundle.customer.legalName,
    customerCountry: bundle.customer.country,
    customerCity: bundle.customer.city,
    contactName: firstDeal.opportunity.contact?.name ?? null,
    items: bundle.quotes.map((q) => ({
      quoteId: q.id,
      version: q.version,
      status: q.status,
      currency: q.currency,
      incoterm: q.incoterm,
      namedPlace: q.namedPlace,
      unitPrice: q.unitPrice.toString(),
      priceUnit: q.priceUnit,
      quantitySaleable: q.scenario.quantitySaleable.toString(),
      totalValue: q.unitPrice.mul(q.scenario.quantitySaleable).toString(),
      productNameAr: q.deal.product.nameAr,
      productNameEn: q.deal.product.nameEn,
      hsCode: q.deal.product.hsCode,
    })),
  };
}
