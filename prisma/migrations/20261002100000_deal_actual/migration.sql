-- النتائج الفعلية بعد تنفيذ الشحنة — مواصفة مشروع ٢ §٢٧.
--
-- ⚠️ **بيانات التقاط**: أي صفقة بتتقفل من غير تسجيل نتيجتها الفعلية بتبقى صفقة
-- مستحيل تتحلل بعدين — مفيش مصدر تاني للرقم. عشان كده البند ده اتبنى **قبل**
-- المحرّكات اللي بتستهلكه (Deal Register §٢٨، Price Waterfall §٣٠، Reorder Price §٣٢).
--
-- ⚠️ **أعمدة المدخلات بس.** كل المخرجات (Actual Full Cost، Actual Profit، Cost Variance،
-- Actual Cash Cycle...) بتتحسب في src/lib/dealActual.ts وقت العرض. لو معادلة اتغيّرت،
-- التعديل في دالة واحدة بدل migration + إعادة حساب + فترة بصفوف محسوبة بمعادلتين.

CREATE TYPE "DeviationReason" AS ENUM (
  'Supplier', 'Quality', 'Waste', 'Processing', 'Packaging', 'InlandTransport',
  'Freight', 'Port', 'Bank', 'Currency', 'Customer', 'Delay', 'Compliance',
  'DataEntryError', 'HiddenCost'
);

CREATE TABLE "DealActual" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "orgId" UUID NOT NULL,
    "dealId" UUID NOT NULL,
    "scenarioId" UUID NOT NULL,
    "actualQuantityRaw" DECIMAL(14,3),
    "actualQuantitySaleable" DECIMAL(14,3),
    "actualWasteQuantity" DECIMAL(14,3),
    "actualPurchasePrice" DECIMAL(14,4),
    "actualProcessingCost" DECIMAL(14,2),
    "actualPackagingCost" DECIMAL(14,2),
    "actualInlandTransport" DECIMAL(14,2),
    "actualPortCharges" DECIMAL(14,2),
    "actualFreight" DECIMAL(14,2),
    "actualBankCharges" DECIMAL(14,2),
    "actualFinanceCost" DECIMAL(14,2),
    "penalties" DECIMAL(14,2),
    "claims" DECIMAL(14,2),
    "postSaleDeductions" DECIMAL(14,2),
    "fxDifference" DECIMAL(14,2),
    "unexpectedCosts" DECIMAL(14,2),
    "unexpectedCostsNote" TEXT,
    "amountCollected" DECIMAL(14,2),
    "collectedAt" TIMESTAMP(3),
    "recordedBy" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DealActual_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DealActualDeviation" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "orgId" UUID NOT NULL,
    "dealActualId" UUID NOT NULL,
    "reason" "DeviationReason" NOT NULL,
    "impactAmount" DECIMAL(14,2),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DealActualDeviation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DealActual_dealId_key" ON "DealActual"("dealId");
CREATE INDEX "DealActual_orgId_idx" ON "DealActual"("orgId");
CREATE UNIQUE INDEX "DealActualDeviation_dealActualId_reason_key" ON "DealActualDeviation"("dealActualId", "reason");
CREATE INDEX "DealActualDeviation_orgId_idx" ON "DealActualDeviation"("orgId");

ALTER TABLE "DealActual" ADD CONSTRAINT "DealActual_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DealActual" ADD CONSTRAINT "DealActual_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DealActual" ADD CONSTRAINT "DealActual_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "DealScenario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DealActual" ADD CONSTRAINT "DealActual_recordedBy_fkey" FOREIGN KEY ("recordedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DealActualDeviation" ADD CONSTRAINT "DealActualDeviation_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DealActualDeviation" ADD CONSTRAINT "DealActualDeviation_dealActualId_fkey" FOREIGN KEY ("dealActualId") REFERENCES "DealActual"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ==================== RLS ====================
ALTER TABLE "DealActual" ENABLE ROW LEVEL SECURITY;
CREATE POLICY dealactual_org_isolation ON "DealActual" FOR ALL USING ("orgId" = current_org_id()) WITH CHECK ("orgId" = current_org_id());
ALTER TABLE "DealActualDeviation" ENABLE ROW LEVEL SECURITY;
CREATE POLICY dealactualdeviation_org_isolation ON "DealActualDeviation" FOR ALL USING ("orgId" = current_org_id()) WITH CHECK ("orgId" = current_org_id());

-- ==================== قيود العمل ====================

-- (١) السيناريو لازم يكون تابع لنفس الصفقة.
-- من غير القيد ده، ممكن نقارن نتيجة صفقة بخطة صفقة تانية خالص والأرقام تطلع
-- بلا معنى وهي شكلها سليم — وده أسوأ من خطأ ظاهر.
CREATE OR REPLACE FUNCTION public.enforce_deal_actual_scenario_matches_deal()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_scenario_deal UUID;
BEGIN
  SELECT "dealId" INTO v_scenario_deal FROM "DealScenario" WHERE id = NEW."scenarioId";
  IF v_scenario_deal IS DISTINCT FROM NEW."dealId" THEN
    RAISE EXCEPTION 'السيناريو المختار مش تابع لنفس الصفقة — المقارنة «مخطط مقابل فعلي» لازم تكون على نفس الصفقة'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.enforce_deal_actual_scenario_matches_deal() FROM PUBLIC;

DROP TRIGGER IF EXISTS deal_actual_scenario_check ON "DealActual";
CREATE TRIGGER deal_actual_scenario_check
  BEFORE INSERT OR UPDATE ON "DealActual"
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_deal_actual_scenario_matches_deal();

-- (٢) الكميات لازم تتسق: الخام = القابل للبيع + الفاقد (بسماحية 0.001 للتقريب).
-- الكميات دي أساس «التكلفة الفعلية للكيلو» و«العائد الفعلي» — لو مش متسقة،
-- كل رقم مشتق منها غلط.
CREATE OR REPLACE FUNCTION public.enforce_deal_actual_quantities()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."actualQuantityRaw" IS NOT NULL
     AND NEW."actualQuantitySaleable" IS NOT NULL
     AND NEW."actualWasteQuantity" IS NOT NULL
     AND abs(NEW."actualQuantityRaw" - (NEW."actualQuantitySaleable" + NEW."actualWasteQuantity")) > 0.001 THEN
    RAISE EXCEPTION 'الكمية الخام (%) لازم تساوي القابل للبيع (%) + الفاقد (%)',
      NEW."actualQuantityRaw", NEW."actualQuantitySaleable", NEW."actualWasteQuantity"
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS deal_actual_quantities_check ON "DealActual";
CREATE TRIGGER deal_actual_quantities_check
  BEFORE INSERT OR UPDATE ON "DealActual"
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_deal_actual_quantities();
