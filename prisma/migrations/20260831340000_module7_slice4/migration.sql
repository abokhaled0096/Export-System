
-- CreateEnum
CREATE TYPE "FarmRiskLevel" AS ENUM ('Low', 'Medium', 'High');

-- CreateEnum
CREATE TYPE "BatchRawMaterialSourceType" AS ENUM ('Farm', 'IncomingInventory');

-- CreateEnum
CREATE TYPE "SupplierRFQStatus" AS ENUM ('Draft', 'Sent', 'Responded', 'Expired', 'Cancelled');

-- CreateEnum
CREATE TYPE "BatchMarketEligibilityStatus" AS ENUM ('Eligible', 'Conditional', 'NotEligible', 'NotAssessed');

-- CreateTable
CREATE TABLE "Farm" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "orgId" UUID NOT NULL,
    "supplierId" UUID NOT NULL,
    "farmerName" TEXT,
    "location" TEXT,
    "areaFeddan" DECIMAL(10,2),
    "crop" TEXT,
    "variety" TEXT,
    "plantingDate" TIMESTAMP(3),
    "expectedHarvestStart" TIMESTAMP(3),
    "expectedHarvestEnd" TIMESTAMP(3),
    "actualHarvestDate" TIMESTAMP(3),
    "expectedQuantity" DECIMAL(14,3),
    "actualQuantity" DECIMAL(14,3),
    "pesticideProgram" JSONB,
    "plotCodes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "riskLevel" "FarmRiskLevel" NOT NULL DEFAULT 'Medium',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Farm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BatchRawMaterialLine" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "orgId" UUID NOT NULL,
    "batchId" UUID NOT NULL,
    "sourceType" "BatchRawMaterialSourceType" NOT NULL,
    "farmId" UUID,
    "inventoryId" UUID,
    "quantity" DECIMAL(14,3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BatchRawMaterialLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierRFQ" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "orgId" UUID NOT NULL,
    "sourcingRequestId" UUID NOT NULL,
    "supplierId" UUID NOT NULL,
    "rfqNumber" TEXT,
    "sentAt" TIMESTAMP(3),
    "responseDeadline" TIMESTAMP(3),
    "respondedAt" TIMESTAMP(3),
    "status" "SupplierRFQStatus" NOT NULL DEFAULT 'Draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierRFQ_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BatchMarketEligibility" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "orgId" UUID NOT NULL,
    "batchId" UUID NOT NULL,
    "marketId" UUID NOT NULL,
    "status" "BatchMarketEligibilityStatus" NOT NULL DEFAULT 'NotAssessed',
    "reason" TEXT,
    "assessedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assessedBy" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BatchMarketEligibility_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Farm_orgId_idx" ON "Farm"("orgId");

-- CreateIndex
CREATE INDEX "Farm_supplierId_idx" ON "Farm"("supplierId");

-- CreateIndex
CREATE INDEX "BatchRawMaterialLine_orgId_idx" ON "BatchRawMaterialLine"("orgId");

-- CreateIndex
CREATE INDEX "BatchRawMaterialLine_batchId_idx" ON "BatchRawMaterialLine"("batchId");

-- CreateIndex
CREATE INDEX "SupplierRFQ_orgId_idx" ON "SupplierRFQ"("orgId");

-- CreateIndex
CREATE INDEX "SupplierRFQ_sourcingRequestId_idx" ON "SupplierRFQ"("sourcingRequestId");

-- CreateIndex
CREATE INDEX "BatchMarketEligibility_orgId_idx" ON "BatchMarketEligibility"("orgId");

-- CreateIndex
CREATE INDEX "BatchMarketEligibility_batchId_idx" ON "BatchMarketEligibility"("batchId");

-- AddForeignKey
ALTER TABLE "Farm" ADD CONSTRAINT "Farm_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Farm" ADD CONSTRAINT "Farm_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BatchRawMaterialLine" ADD CONSTRAINT "BatchRawMaterialLine_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BatchRawMaterialLine" ADD CONSTRAINT "BatchRawMaterialLine_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BatchRawMaterialLine" ADD CONSTRAINT "BatchRawMaterialLine_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BatchRawMaterialLine" ADD CONSTRAINT "BatchRawMaterialLine_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "Inventory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierRFQ" ADD CONSTRAINT "SupplierRFQ_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierRFQ" ADD CONSTRAINT "SupplierRFQ_sourcingRequestId_fkey" FOREIGN KEY ("sourcingRequestId") REFERENCES "SourcingRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierRFQ" ADD CONSTRAINT "SupplierRFQ_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BatchMarketEligibility" ADD CONSTRAINT "BatchMarketEligibility_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BatchMarketEligibility" ADD CONSTRAINT "BatchMarketEligibility_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BatchMarketEligibility" ADD CONSTRAINT "BatchMarketEligibility_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BatchMarketEligibility" ADD CONSTRAINT "BatchMarketEligibility_assessedBy_fkey" FOREIGN KEY ("assessedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============ RLS: عزل orgId على الأربعة (بلا Trigger — مفيش قيد عمل حرج صريح في الـERD) ============
ALTER TABLE "Farm" ENABLE ROW LEVEL SECURITY;
CREATE POLICY farm_org_isolation ON "Farm"
  FOR ALL USING ("orgId" = current_org_id()) WITH CHECK ("orgId" = current_org_id());

ALTER TABLE "BatchRawMaterialLine" ENABLE ROW LEVEL SECURITY;
CREATE POLICY batch_raw_material_line_org_isolation ON "BatchRawMaterialLine"
  FOR ALL USING ("orgId" = current_org_id()) WITH CHECK ("orgId" = current_org_id());

ALTER TABLE "SupplierRFQ" ENABLE ROW LEVEL SECURITY;
CREATE POLICY supplier_rfq_org_isolation ON "SupplierRFQ"
  FOR ALL USING ("orgId" = current_org_id()) WITH CHECK ("orgId" = current_org_id());

ALTER TABLE "BatchMarketEligibility" ENABLE ROW LEVEL SECURITY;
CREATE POLICY batch_market_eligibility_org_isolation ON "BatchMarketEligibility"
  FOR ALL USING ("orgId" = current_org_id()) WITH CHECK ("orgId" = current_org_id());

