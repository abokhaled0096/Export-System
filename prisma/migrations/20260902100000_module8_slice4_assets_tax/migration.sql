-- CreateEnum
CREATE TYPE "BudgetType" AS ENUM ('Sales', 'Purchase', 'OPEX', 'CAPEX', 'Cash');

-- CreateEnum
CREATE TYPE "FixedAssetCategory" AS ENUM ('Equipment', 'Vehicle', 'Furniture', 'Building', 'ComputerHardware', 'Other');

-- CreateEnum
CREATE TYPE "DepreciationMethod" AS ENUM ('StraightLine', 'DecliningBalance');

-- CreateEnum
CREATE TYPE "FixedAssetStatus" AS ENUM ('Active', 'Disposed', 'Impaired');

-- CreateEnum
CREATE TYPE "TaxType" AS ENUM ('VATOutput', 'VATInput', 'WithholdingTax', 'PayrollTax');

-- CreateEnum
CREATE TYPE "TaxFilingStatus" AS ENUM ('NotFiled', 'Filed', 'Paid');

-- CreateTable
CREATE TABLE "Budget" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "orgId" UUID NOT NULL,
    "periodId" UUID NOT NULL,
    "budgetType" "BudgetType" NOT NULL,
    "costCenterId" UUID,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Budget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FixedAsset" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "orgId" UUID NOT NULL,
    "assetCode" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "category" "FixedAssetCategory" NOT NULL,
    "costCenterId" UUID,
    "purchaseDate" TIMESTAMP(3) NOT NULL,
    "purchaseValue" DECIMAL(14,2) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "usefulLifeMonths" INTEGER NOT NULL,
    "depreciationMethod" "DepreciationMethod" NOT NULL DEFAULT 'StraightLine',
    "accumulatedDepreciation" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "netBookValue" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "disposalDate" TIMESTAMP(3),
    "disposalValue" DECIMAL(14,2),
    "disposalJournalEntryId" UUID,
    "status" "FixedAssetStatus" NOT NULL DEFAULT 'Active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FixedAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DepreciationEntry" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "orgId" UUID NOT NULL,
    "assetId" UUID NOT NULL,
    "period" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "journalEntryId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DepreciationEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxRecord" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "orgId" UUID NOT NULL,
    "taxType" "TaxType" NOT NULL,
    "periodId" UUID NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "filingStatus" "TaxFilingStatus" NOT NULL DEFAULT 'NotFiled',
    "filingDate" TIMESTAMP(3),
    "etaReference" TEXT,
    "paymentId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaxRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Budget_orgId_idx" ON "Budget"("orgId");

-- CreateIndex
CREATE INDEX "Budget_periodId_idx" ON "Budget"("periodId");

-- CreateIndex
CREATE UNIQUE INDEX "Budget_orgId_periodId_budgetType_costCenterId_currency_key" ON "Budget"("orgId", "periodId", "budgetType", "costCenterId", "currency");

-- CreateIndex
CREATE INDEX "FixedAsset_orgId_idx" ON "FixedAsset"("orgId");

-- CreateIndex
CREATE INDEX "FixedAsset_costCenterId_idx" ON "FixedAsset"("costCenterId");

-- CreateIndex
CREATE UNIQUE INDEX "FixedAsset_orgId_assetCode_key" ON "FixedAsset"("orgId", "assetCode");

-- CreateIndex
CREATE INDEX "DepreciationEntry_orgId_idx" ON "DepreciationEntry"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "DepreciationEntry_assetId_period_key" ON "DepreciationEntry"("assetId", "period");

-- CreateIndex
CREATE INDEX "TaxRecord_orgId_idx" ON "TaxRecord"("orgId");

-- CreateIndex
CREATE INDEX "TaxRecord_periodId_idx" ON "TaxRecord"("periodId");

-- CreateIndex
CREATE UNIQUE INDEX "TaxRecord_orgId_taxType_periodId_key" ON "TaxRecord"("orgId", "taxType", "periodId");

-- AddForeignKey
ALTER TABLE "Budget" ADD CONSTRAINT "Budget_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Budget" ADD CONSTRAINT "Budget_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "AccountingPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Budget" ADD CONSTRAINT "Budget_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "CostCenter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixedAsset" ADD CONSTRAINT "FixedAsset_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixedAsset" ADD CONSTRAINT "FixedAsset_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "CostCenter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixedAsset" ADD CONSTRAINT "FixedAsset_disposalJournalEntryId_fkey" FOREIGN KEY ("disposalJournalEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepreciationEntry" ADD CONSTRAINT "DepreciationEntry_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepreciationEntry" ADD CONSTRAINT "DepreciationEntry_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "FixedAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepreciationEntry" ADD CONSTRAINT "DepreciationEntry_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxRecord" ADD CONSTRAINT "TaxRecord_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxRecord" ADD CONSTRAINT "TaxRecord_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "AccountingPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxRecord" ADD CONSTRAINT "TaxRecord_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;



-- ============ RLS: عزل org لكل جدول جديد ============
ALTER TABLE "Budget" ENABLE ROW LEVEL SECURITY;
CREATE POLICY budget_org_isolation ON "Budget" FOR ALL USING ("orgId" = current_org_id()) WITH CHECK ("orgId" = current_org_id());

ALTER TABLE "FixedAsset" ENABLE ROW LEVEL SECURITY;
CREATE POLICY fixedasset_org_isolation ON "FixedAsset" FOR ALL USING ("orgId" = current_org_id()) WITH CHECK ("orgId" = current_org_id());

ALTER TABLE "DepreciationEntry" ENABLE ROW LEVEL SECURITY;
CREATE POLICY depreciationentry_org_isolation ON "DepreciationEntry" FOR ALL USING ("orgId" = current_org_id()) WITH CHECK ("orgId" = current_org_id());

ALTER TABLE "TaxRecord" ENABLE ROW LEVEL SECURITY;
CREATE POLICY taxrecord_org_isolation ON "TaxRecord" FOR ALL USING ("orgId" = current_org_id()) WITH CHECK ("orgId" = current_org_id());


-- ============ 1. الإهلاك مايتجاوزش القيمة القابلة للإهلاك + منع إهلاك أصل متباع/منعدم القيمة ============
-- docs/ERD.md §11.4 مفيهوش أي قيد يمنع تجاوز إجمالي الإهلاك لقيمة الأصل، ولا يمنع الإهلاك
-- بعد التخلص من الأصل أو انعدام قيمته.
CREATE OR REPLACE FUNCTION public.enforce_depreciation_within_value()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_purchase_value DECIMAL;
  v_status         TEXT;
  v_accumulated    DECIMAL;
BEGIN
  IF NEW."amount" <= 0 THEN
    RAISE EXCEPTION 'مبلغ الإهلاك لازم يكون أكبر من صفر' USING ERRCODE = '23514';
  END IF;

  SELECT "purchaseValue", "status"::text INTO v_purchase_value, v_status FROM "FixedAsset" WHERE id = NEW."assetId";

  IF v_status <> 'Active' THEN
    RAISE EXCEPTION 'مينفعش تسجيل إهلاك لأصل حالته % — الإهلاك للأصول النشطة بس', v_status
      USING ERRCODE = '23514';
  END IF;

  SELECT COALESCE(SUM("amount"), 0) INTO v_accumulated
    FROM "DepreciationEntry"
   WHERE "assetId" = NEW."assetId"
     AND (TG_OP = 'INSERT' OR id <> NEW.id);

  IF v_accumulated + NEW."amount" > v_purchase_value THEN
    RAISE EXCEPTION 'مجموع الإهلاك (%) بيتجاوز قيمة شراء الأصل (%)', v_accumulated + NEW."amount", v_purchase_value
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.enforce_depreciation_within_value() FROM PUBLIC;

CREATE TRIGGER depreciation_within_value_check
  BEFORE INSERT OR UPDATE ON "DepreciationEntry"
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_depreciation_within_value();


-- ============ 2. صيانة accumulatedDepreciation/netBookValue تلقائيًا ============
-- ⚠️ انحراف واعٍ عن docs/ERD.md §11.4: أهم رقمين في الأصل (مجمّع الإهلاك والقيمة الدفترية
-- الصافية) مش موجودين في المواصفة خالص. نفس نمط sync_loan_outstanding من شريحة الخزينة.
CREATE OR REPLACE FUNCTION public.sync_fixed_asset_accumulated_depreciation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_asset     UUID;
  v_purchase  DECIMAL;
  v_total     DECIMAL;
BEGIN
  v_asset := COALESCE(NEW."assetId", OLD."assetId");

  SELECT "purchaseValue" INTO v_purchase FROM "FixedAsset" WHERE id = v_asset;
  SELECT COALESCE(SUM("amount"), 0) INTO v_total FROM "DepreciationEntry" WHERE "assetId" = v_asset;

  UPDATE "FixedAsset"
     SET "accumulatedDepreciation" = v_total,
         "netBookValue" = v_purchase - v_total
   WHERE id = v_asset;

  RETURN NULL;
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.sync_fixed_asset_accumulated_depreciation() FROM PUBLIC;

CREATE TRIGGER depreciation_entry_sync_asset
  AFTER INSERT OR UPDATE OR DELETE ON "DepreciationEntry"
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_fixed_asset_accumulated_depreciation();


-- ============ 3. التخلص من أصل: لازم قيد محاسبي موجود فعلًا قبل تأكيد الحالة ============
-- docs/ERD.md §11.4 عنده disposalDate/disposalValue بس بلا أي قيد — المحاسبة الصحيحة تستوجب
-- شطب التكلفة ومجمّع الإهلاك وإثبات ربح/خسارة التخلص، مش مجرد تغيير status.
CREATE OR REPLACE FUNCTION public.enforce_fixed_asset_disposal()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD."status" = 'Disposed' AND NEW."status" <> 'Disposed' THEN
    RAISE EXCEPTION 'الأصل المتباع مايرجعش لحالة تانية — سجل نهائي' USING ERRCODE = '23514';
  END IF;

  IF NEW."status" = 'Disposed' THEN
    IF NEW."disposalDate" IS NULL OR NEW."disposalValue" IS NULL OR NEW."disposalJournalEntryId" IS NULL THEN
      RAISE EXCEPTION 'مينفعش تأكيد التخلص من أصل بلا تاريخ التخلص وحصيلته والقيد المحاسبي المقابل'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.enforce_fixed_asset_disposal() FROM PUBLIC;

CREATE TRIGGER fixed_asset_disposal_check
  BEFORE UPDATE ON "FixedAsset"
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_fixed_asset_disposal();


-- ============ 4. سلامة مبلغ بند الموازنة ============
CREATE OR REPLACE FUNCTION public.enforce_budget_amount_positive()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF NEW."amount" <= 0 THEN
    RAISE EXCEPTION 'مبلغ بند الموازنة لازم يكون أكبر من صفر' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.enforce_budget_amount_positive() FROM PUBLIC;

CREATE TRIGGER budget_amount_positive_check
  BEFORE INSERT OR UPDATE ON "Budget"
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_budget_amount_positive();


-- ============ 5. إقفال الإقرار الضريبي: مرفوض إلا لو مسدَّد فعليًا بدفعة حقيقية ============
-- docs/ERD.md §11.4 بيسيب filingStatus=Paid بلا أي حركة نقدية — نفس عيب LoanInstallment.status=Paid
-- اللي اتعالج في شريحة الخزينة بالحرف.
CREATE OR REPLACE FUNCTION public.enforce_tax_record_filing()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF NEW."filingStatus" = 'Paid' AND NEW."paymentId" IS NULL THEN
    RAISE EXCEPTION 'مينفعش تعليم الإقرار الضريبي "مدفوع" بلا دفعة حقيقية مربوطة' USING ERRCODE = '23514';
  END IF;

  IF NEW."filingStatus" IN ('Filed', 'Paid') AND NEW."filingDate" IS NULL THEN
    RAISE EXCEPTION 'الإقرار الضريبي المُرحَّل لازم يسجّل تاريخ التقديم' USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.enforce_tax_record_filing() FROM PUBLIC;

CREATE TRIGGER tax_record_filing_check
  BEFORE INSERT OR UPDATE ON "TaxRecord"
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_tax_record_filing();
