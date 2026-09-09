-- ProductMarketAnalysis: منع تكرار نفس التركيبة (منتج × سوق × سنة) بلا نسخ (versioning)، بعد ما
-- اتكشف حيًا إن تشغيل الدفعة الشاملة أكتر من مرة بيعمل صفوف جديدة كل مرة بلا أي علاقة بالقديم —
-- 17 صف لـ12 تركيبة فعلية، بعضهم متطابق حرفيًا. الحل: عمود supersededAt يتحطّ تلقائيًا (Trigger)
-- على أي نسخة قديمة لما نسخة جديدة تتعمل لنفس التركيبة، وفهرس فريد جزئي يمنع وجود أكتر من نسخة
-- نشطة واحدة. البيانات بتتحفظ (مفيش حذف)، بس بيبقى واضح مين النسخة النشطة.

-- الأعمدة
ALTER TABLE "ProductMarketAnalysis" ADD COLUMN "supersededAt" TIMESTAMP(3);
ALTER TABLE "ProductMarketAnalysis" ADD COLUMN "validUntil" TIMESTAMP(3) DEFAULT (now() + interval '90 days');

-- Backfill: صلاحية الصفوف القديمة اتحسب من تاريخ إنشائها، مش NULL للأبد.
UPDATE "ProductMarketAnalysis" SET "validUntil" = "createdAt" + interval '90 days' WHERE "validUntil" IS NULL;

-- Backfill: البيانات الحية دلوقتي فيها صفوف مكرّرة لنفس التركيبة (نفس المشكلة اللي الـmigration
-- ده بيمنعها مستقبلًا) — نسيب الأحدث بس نشط (supersededAt IS NULL) والباقي يتعلّم "مستبدَل"،
-- عشان الفهرس الفريد تحت يقدر يتعمل من غير ما يترفض.
WITH ranked AS (
  SELECT "id", ROW_NUMBER() OVER (
    PARTITION BY "orgId", "productId", "marketId", "year"
    ORDER BY "createdAt" DESC, "id" DESC
  ) AS rn
  FROM "ProductMarketAnalysis"
  WHERE "deletedAt" IS NULL
)
UPDATE "ProductMarketAnalysis" p
SET "supersededAt" = now()
FROM ranked r
WHERE p."id" = r."id" AND r.rn > 1;

-- فهرس فريد جزئي — نسخة نشطة واحدة بس لكل (منظمة، منتج، سوق، سنة). بلا تمثيل في schema.prisma
-- عمدًا (نفس نمط Market_orgId_countryCode_active_key — Prisma DSL مش بيدعم partial unique index).
CREATE UNIQUE INDEX "ProductMarketAnalysis_org_product_market_year_active_key"
  ON "ProductMarketAnalysis" ("orgId", "productId", "marketId", "year")
  WHERE "supersededAt" IS NULL AND "deletedAt" IS NULL;

-- Trigger: BEFORE INSERT (مش AFTER) عمدًا — لازم النسخة القديمة تتعلّم "مستبدَلة" *قبل* ما الفهرس
-- الفريد فوق يتفحص وقت الـINSERT نفسه، وإلا الفهرس هيرفض النسخة الجديدة لأن القديمة لسه نشطة.
CREATE OR REPLACE FUNCTION public.supersede_previous_product_market_analysis()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE "ProductMarketAnalysis"
  SET "supersededAt" = now()
  WHERE "orgId" = NEW."orgId"
    AND "productId" = NEW."productId"
    AND "marketId" = NEW."marketId"
    AND "year" = NEW."year"
    AND "supersededAt" IS NULL
    AND "deletedAt" IS NULL;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.supersede_previous_product_market_analysis() FROM PUBLIC;

CREATE TRIGGER product_market_analysis_supersede_previous
  BEFORE INSERT ON "ProductMarketAnalysis"
  FOR EACH ROW
  EXECUTE FUNCTION public.supersede_previous_product_market_analysis();
