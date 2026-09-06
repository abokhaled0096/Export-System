-- AlterTable
ALTER TABLE "Quote" ADD COLUMN     "bundleId" UUID;

-- CreateTable
CREATE TABLE "QuoteBundle" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "orgId" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "createdBy" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuoteBundle_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "QuoteBundle_orgId_idx" ON "QuoteBundle"("orgId");

-- CreateIndex
CREATE INDEX "QuoteBundle_customerId_idx" ON "QuoteBundle"("customerId");

-- CreateIndex
CREATE INDEX "Quote_bundleId_idx" ON "Quote"("bundleId");

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_bundleId_fkey" FOREIGN KEY ("bundleId") REFERENCES "QuoteBundle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteBundle" ADD CONSTRAINT "QuoteBundle_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteBundle" ADD CONSTRAINT "QuoteBundle_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteBundle" ADD CONSTRAINT "QuoteBundle_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ============ RLS: عزل org ============
ALTER TABLE "QuoteBundle" ENABLE ROW LEVEL SECURITY;
CREATE POLICY quotebundle_org_isolation ON "QuoteBundle" FOR ALL USING ("orgId" = current_org_id()) WITH CHECK ("orgId" = current_org_id());


-- ============ نفس العميل لكل عروض الأسعار في نفس الحزمة ============
-- مستند واحد بيتبعت لعميل واحد — لو Quote.bundleId اتحط، لازم عميل الـQuote يطابق عميل الحزمة
-- بالظبط. القاعدة دي مفروضة هنا (Trigger) مش تحقق واجهة بس، لأنها سلامة بيانات structural حقيقية.
CREATE OR REPLACE FUNCTION public.enforce_quote_bundle_same_customer()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_bundle_customer UUID;
BEGIN
  IF NEW."bundleId" IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT "customerId" INTO v_bundle_customer FROM "QuoteBundle" WHERE id = NEW."bundleId";

  IF v_bundle_customer IS DISTINCT FROM NEW."customerId" THEN
    RAISE EXCEPTION 'مينفعش تضيف عرض السعر للحزمة — عميل العرض مختلف عن عميل الحزمة'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.enforce_quote_bundle_same_customer() FROM PUBLIC;

CREATE TRIGGER quote_bundle_same_customer_check
  BEFORE INSERT OR UPDATE ON "Quote"
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_quote_bundle_same_customer();
