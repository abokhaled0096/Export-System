-- حقول التقاط — مواصفة مشروع ٣ §٩ (سجل مصدر العميل) و§٤١ (تحليل الفوز والخسارة).
--
-- ⚠️ ليه دول اتبنوا قبل المحرّكات اللي بتستهلكهم (Lead Source Score، Win/Loss Analysis):
-- دي **بيانات التقاط**، مش بيانات تحليل. الفرق جوهري:
--   • محرك تحليل ينفع يتبني بعد سنة وهيحسب من البيانات الموجودة بأثر رجعي.
--   • حقل التقاط لو مااتسجّلش في لحظته، **ضايع للأبد**.
-- الشركة بتفتح دلوقتي، فكل يوم من غير الحقول دي = عملاء مسجَّلين بلا مصدر وصفقات
-- مقفولة بلا تاريخ إقفال، ومفيش قوة ترجّعهم. (قرار 1 أكتوبر 2026.)
--
-- `Deal.closedAt` تحديدًا: `updatedAt` **مش بديل** عنه — أي تعديل لاحق على الصفقة
-- بيدوسه، فزمن دورة البيع ومعدّل الفوز عبر الزمن بيبقوا غير قابلين للحساب.

CREATE TYPE "LeadSourceType" AS ENUM (
  'GoogleSearch', 'GoogleMaps', 'LinkedIn', 'CompanyDirectory', 'TradeFair',
  'ChamberOfCommerce', 'IndustryAssociation', 'GovernmentSite', 'CommercialRegistry',
  'TradePlatform', 'ShippingData', 'TenderSite', 'Referral', 'ExistingCustomer',
  'Supplier', 'Embassy', 'ImporterList', 'CompanyWebsite', 'SocialMedia', 'ManualEntry'
);

ALTER TABLE "Company" ADD COLUMN "leadSourceType" "LeadSourceType";
ALTER TABLE "Company" ADD COLUMN "leadSourceDetail" TEXT;
ALTER TABLE "Company" ADD COLUMN "leadFoundAt" TIMESTAMP(3);
ALTER TABLE "Company" ADD COLUMN "leadFoundBy" UUID;
ALTER TABLE "Company" ADD CONSTRAINT "Company_leadFoundBy_fkey"
  FOREIGN KEY ("leadFoundBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Deal" ADD COLUMN "closedAt" TIMESTAMP(3);

-- الصفقات المقفولة الموجودة بالفعل: `updatedAt` أقرب تقريب متاح، وبيتسجّل مرة واحدة
-- دلوقتي بس. ده **تقريب للبيانات القديمة** مش قاعدة — الصفقات الجديدة هتاخد التاريخ
-- الحقيقي من التريجر تحت.
UPDATE "Deal" SET "closedAt" = "updatedAt" WHERE "status" IN ('Won', 'Lost') AND "closedAt" IS NULL;

-- ⚠️ التاريخ بيتسجّل بـTrigger مش بالواجهة: أي مسار يقفل الصفقة (فورم، سكريبت،
-- استيراد) لازم يسجّله، وإلا البيانات بتضيع من المسارات اللي الواجهة مش شايفاها.
-- نفس مبدأ "القيد الحرج في القاعدة مش في الواجهة" (CLAUDE.md).
CREATE OR REPLACE FUNCTION public.set_deal_closed_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- اتقفلت دلوقتي ومالهاش تاريخ → سجّل.
  IF NEW."status" IN ('Won', 'Lost') AND NEW."closedAt" IS NULL THEN
    NEW."closedAt" := now();
  END IF;
  -- اتفتحت تاني (رجعت لتفاوض مثلًا) → امسح التاريخ، عشان ما يفضلش تاريخ إقفال كداب.
  IF NEW."status" NOT IN ('Won', 'Lost') THEN
    NEW."closedAt" := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS deal_closed_at_sync ON "Deal";
CREATE TRIGGER deal_closed_at_sync
  BEFORE INSERT OR UPDATE ON "Deal"
  FOR EACH ROW
  EXECUTE FUNCTION public.set_deal_closed_at();
