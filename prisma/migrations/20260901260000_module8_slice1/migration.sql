-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('Asset', 'Liability', 'Equity', 'Revenue', 'COGS', 'Expense');

-- CreateEnum
CREATE TYPE "NormalBalance" AS ENUM ('Debit', 'Credit');

-- CreateEnum
CREATE TYPE "AccountingPeriodStatus" AS ENUM ('Open', 'SoftClosed', 'HardClosed');

-- CreateEnum
CREATE TYPE "JournalEntrySourceType" AS ENUM ('Manual', 'Automatic', 'Recurring', 'Reversal', 'Accrual', 'Adjustment');

-- CreateEnum
CREATE TYPE "JournalEntryStatus" AS ENUM ('Draft', 'Posted', 'Reversed');

-- CreateEnum
CREATE TYPE "CostCenterType" AS ENUM ('Department', 'Product', 'Customer', 'Deal', 'Market');

-- CreateEnum
CREATE TYPE "ProfitCenterScope" AS ENUM ('Company', 'Division', 'Product', 'Market');

-- CreateTable
CREATE TABLE "ChartOfAccount" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "orgId" UUID NOT NULL,
    "accountCode" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "accountType" "AccountType" NOT NULL,
    "parentAccountId" UUID,
    "normalBalance" "NormalBalance" NOT NULL,
    "currency" CHAR(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChartOfAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountingPeriod" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "orgId" UUID NOT NULL,
    "periodName" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" "AccountingPeriodStatus" NOT NULL DEFAULT 'Open',
    "closedBy" UUID,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountingPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalEntry" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "orgId" UUID NOT NULL,
    "entryNumber" TEXT NOT NULL,
    "entryDate" TIMESTAMP(3) NOT NULL,
    "periodId" UUID NOT NULL,
    "sourceType" "JournalEntrySourceType" NOT NULL DEFAULT 'Manual',
    "sourceModule" TEXT,
    "description" TEXT,
    "status" "JournalEntryStatus" NOT NULL DEFAULT 'Draft',
    "preparedBy" UUID NOT NULL,
    "reviewedBy" UUID,
    "approvedBy" UUID,
    "reversalOfId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JournalEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalLine" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "orgId" UUID NOT NULL,
    "journalEntryId" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "debit" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "credit" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "currency" CHAR(3) NOT NULL,
    "fxRateId" UUID,
    "costCenterId" UUID,
    "profitCenterId" UUID,
    "dealId" UUID,
    "shipmentId" UUID,
    "supplierId" UUID,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JournalLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CostCenter" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "orgId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "CostCenterType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CostCenter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfitCenter" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "orgId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "scope" "ProfitCenterScope" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProfitCenter_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChartOfAccount_orgId_idx" ON "ChartOfAccount"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "ChartOfAccount_orgId_accountCode_key" ON "ChartOfAccount"("orgId", "accountCode");

-- CreateIndex
CREATE INDEX "AccountingPeriod_orgId_idx" ON "AccountingPeriod"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "AccountingPeriod_orgId_periodName_key" ON "AccountingPeriod"("orgId", "periodName");

-- CreateIndex
CREATE INDEX "JournalEntry_orgId_idx" ON "JournalEntry"("orgId");

-- CreateIndex
CREATE INDEX "JournalEntry_periodId_idx" ON "JournalEntry"("periodId");

-- CreateIndex
CREATE UNIQUE INDEX "JournalEntry_orgId_entryNumber_key" ON "JournalEntry"("orgId", "entryNumber");

-- CreateIndex
CREATE INDEX "JournalLine_orgId_idx" ON "JournalLine"("orgId");

-- CreateIndex
CREATE INDEX "JournalLine_journalEntryId_idx" ON "JournalLine"("journalEntryId");

-- CreateIndex
CREATE INDEX "JournalLine_accountId_idx" ON "JournalLine"("accountId");

-- CreateIndex
CREATE INDEX "CostCenter_orgId_idx" ON "CostCenter"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "CostCenter_orgId_code_key" ON "CostCenter"("orgId", "code");

-- CreateIndex
CREATE INDEX "ProfitCenter_orgId_idx" ON "ProfitCenter"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "ProfitCenter_orgId_code_key" ON "ProfitCenter"("orgId", "code");

-- AddForeignKey
ALTER TABLE "ChartOfAccount" ADD CONSTRAINT "ChartOfAccount_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChartOfAccount" ADD CONSTRAINT "ChartOfAccount_parentAccountId_fkey" FOREIGN KEY ("parentAccountId") REFERENCES "ChartOfAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountingPeriod" ADD CONSTRAINT "AccountingPeriod_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountingPeriod" ADD CONSTRAINT "AccountingPeriod_closedBy_fkey" FOREIGN KEY ("closedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "AccountingPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_preparedBy_fkey" FOREIGN KEY ("preparedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_reviewedBy_fkey" FOREIGN KEY ("reviewedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_approvedBy_fkey" FOREIGN KEY ("approvedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_reversalOfId_fkey" FOREIGN KEY ("reversalOfId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "ChartOfAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_fxRateId_fkey" FOREIGN KEY ("fxRateId") REFERENCES "ExchangeRate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "CostCenter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_profitCenterId_fkey" FOREIGN KEY ("profitCenterId") REFERENCES "ProfitCenter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostCenter" ADD CONSTRAINT "CostCenter_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfitCenter" ADD CONSTRAINT "ProfitCenter_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- RLS: عزل org لكل جدول جديد
ALTER TABLE "ChartOfAccount" ENABLE ROW LEVEL SECURITY;
CREATE POLICY chartofaccount_org_isolation ON "ChartOfAccount" FOR ALL USING ("orgId" = current_org_id()) WITH CHECK ("orgId" = current_org_id());

ALTER TABLE "AccountingPeriod" ENABLE ROW LEVEL SECURITY;
CREATE POLICY accountingperiod_org_isolation ON "AccountingPeriod" FOR ALL USING ("orgId" = current_org_id()) WITH CHECK ("orgId" = current_org_id());

ALTER TABLE "JournalEntry" ENABLE ROW LEVEL SECURITY;
CREATE POLICY journalentry_org_isolation ON "JournalEntry" FOR ALL USING ("orgId" = current_org_id()) WITH CHECK ("orgId" = current_org_id());

ALTER TABLE "JournalLine" ENABLE ROW LEVEL SECURITY;
CREATE POLICY journalline_org_isolation ON "JournalLine" FOR ALL USING ("orgId" = current_org_id()) WITH CHECK ("orgId" = current_org_id());

ALTER TABLE "CostCenter" ENABLE ROW LEVEL SECURITY;
CREATE POLICY costcenter_org_isolation ON "CostCenter" FOR ALL USING ("orgId" = current_org_id()) WITH CHECK ("orgId" = current_org_id());

ALTER TABLE "ProfitCenter" ENABLE ROW LEVEL SECURITY;
CREATE POLICY profitcenter_org_isolation ON "ProfitCenter" FOR ALL USING ("orgId" = current_org_id()) WITH CHECK ("orgId" = current_org_id());

-- ============ Trigger 1: قيد مزدوج حقيقي — SUM(debit) = SUM(credit) وقت الترحيل (docs/ERD.md §11.1) ============
CREATE OR REPLACE FUNCTION public.enforce_journal_entry_balanced()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_debit NUMERIC;
  v_total_credit NUMERIC;
BEGIN
  IF NEW."status" = 'Posted' AND (OLD."status" IS DISTINCT FROM 'Posted') THEN
    SELECT COALESCE(SUM("debit"), 0), COALESCE(SUM("credit"), 0)
      INTO v_total_debit, v_total_credit
      FROM "JournalLine"
      WHERE "journalEntryId" = NEW.id;

    IF v_total_debit != v_total_credit THEN
      RAISE EXCEPTION 'القيد غير متوازن — إجمالي المدين (%) لازم يساوي إجمالي الدائن (%) قبل الترحيل', v_total_debit, v_total_credit
        USING ERRCODE = '23514';
    END IF;

    IF v_total_debit = 0 THEN
      RAISE EXCEPTION 'مينفعش ترحيل قيد بلا بنود — لازم يكون فيه بنود مدين/دائن فعلية'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.enforce_journal_entry_balanced() FROM PUBLIC;

CREATE TRIGGER journal_entry_balanced_check
  BEFORE UPDATE ON "JournalEntry"
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_journal_entry_balanced();

-- ============ Trigger 2: منع كتابة بنود لفترة محاسبية مقفولة نهائيًا (docs/ERD.md §11.1) ============
CREATE OR REPLACE FUNCTION public.enforce_accounting_period_not_hard_closed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_period_status TEXT;
  v_period_name TEXT;
BEGIN
  SELECT ap."status", ap."periodName" INTO v_period_status, v_period_name
    FROM "JournalEntry" je
    JOIN "AccountingPeriod" ap ON ap.id = je."periodId"
    WHERE je.id = NEW."journalEntryId";

  IF v_period_status = 'HardClosed' THEN
    RAISE EXCEPTION 'الفترة المحاسبية "%" مقفولة نهائيًا (HardClosed) — مينفعش يتضاف لها بنود جديدة، افتح قيد تسوية في فترة مفتوحة لاحقة', v_period_name
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.enforce_accounting_period_not_hard_closed() FROM PUBLIC;

CREATE TRIGGER journal_line_period_lock_check
  BEFORE INSERT ON "JournalLine"
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_accounting_period_not_hard_closed();
