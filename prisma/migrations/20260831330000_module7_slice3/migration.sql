
-- CreateEnum
CREATE TYPE "ProductionProcess" AS ENUM ('Sorting', 'Grading', 'Washing', 'Cutting', 'Peeling', 'Freezing', 'Drying', 'Milling', 'Sterilization', 'Fumigation', 'Extraction', 'Mixing', 'Packing', 'Labeling', 'Palletizing');

-- CreateEnum
CREATE TYPE "ProductionPlanStatus" AS ENUM ('Draft', 'Scheduled', 'MaterialsPending', 'Ready', 'InProduction', 'QualityHold', 'Rework', 'Completed', 'Delayed', 'Cancelled');

-- CreateEnum
CREATE TYPE "InventoryType" AS ENUM ('RawMaterial', 'WIP', 'FinishedGoods', 'PackagingMaterial');

-- CreateEnum
CREATE TYPE "InventoryStatus" AS ENUM ('Expected', 'Received', 'Quarantine', 'Accepted', 'Conditional', 'Rejected', 'Reserved', 'InProduction', 'Consumed', 'Expired');

-- CreateEnum
CREATE TYPE "NCRType" AS ENUM ('RawMaterialDefect', 'SpecificationFailure', 'PackagingFailure', 'LabelError', 'WeightDeviation', 'MoistureFailure', 'PurityFailure', 'MicrobiologicalFailure', 'PesticideFailure', 'TemperatureFailure', 'ForeignMatter', 'TraceabilityFailure', 'DocumentationFailure', 'SupplierDelay', 'QuantityShortage', 'MixedBatch');

-- CreateEnum
CREATE TYPE "NCRSeverity" AS ENUM ('Observation', 'Minor', 'Major', 'Critical');

-- CreateEnum
CREATE TYPE "NCRStatus" AS ENUM ('Open', 'Investigation', 'ActionInProgress', 'Closed');

-- CreateEnum
CREATE TYPE "LabTestType" AS ENUM ('Physical', 'Chemical', 'Microbiological', 'PesticideResidues', 'HeavyMetals', 'Moisture', 'Purity', 'Aflatoxins', 'Mycotoxins', 'Allergens', 'GMO');

-- CreateEnum
CREATE TYPE "LabTestPassFail" AS ENUM ('Pass', 'Fail');

-- CreateTable
CREATE TABLE "ProductionPlan" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "orgId" UUID NOT NULL,
    "purchaseOrderId" UUID NOT NULL,
    "facilityId" UUID NOT NULL,
    "process" "ProductionProcess" NOT NULL,
    "rawQuantity" DECIMAL(14,3),
    "targetYield" DECIMAL(5,4),
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "packagingDate" TIMESTAMP(3),
    "cargoReadyDate" TIMESTAMP(3),
    "status" "ProductionPlanStatus" NOT NULL DEFAULT 'Draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductionPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Inventory" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "orgId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "batchId" UUID,
    "lotId" UUID,
    "inventoryType" "InventoryType" NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL,
    "unit" TEXT,
    "location" TEXT,
    "status" "InventoryStatus" NOT NULL DEFAULT 'Expected',
    "reservedForDealId" UUID,
    "expiryDate" TIMESTAMP(3),
    "unitCost" DECIMAL(14,4),
    "currency" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Inventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NCR" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "orgId" UUID NOT NULL,
    "supplierId" UUID NOT NULL,
    "facilityId" UUID NOT NULL,
    "batchId" UUID,
    "lotId" UUID,
    "ncrType" "NCRType" NOT NULL,
    "severity" "NCRSeverity" NOT NULL,
    "quantityAffected" DECIMAL(14,3),
    "financialExposure" DECIMAL(14,2),
    "currency" TEXT,
    "immediateContainment" TEXT,
    "status" "NCRStatus" NOT NULL DEFAULT 'Open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NCR_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LabTest" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "orgId" UUID NOT NULL,
    "inspectionId" UUID,
    "batchId" UUID NOT NULL,
    "testType" "LabTestType" NOT NULL,
    "parameter" TEXT,
    "unit" TEXT,
    "minLimit" DECIMAL(14,4),
    "maxLimit" DECIMAL(14,4),
    "actualResult" DECIMAL(14,4),
    "method" TEXT,
    "laboratory" TEXT,
    "isAccredited" BOOLEAN NOT NULL DEFAULT false,
    "testDate" TIMESTAMP(3),
    "resultDate" TIMESTAMP(3),
    "passFail" "LabTestPassFail" NOT NULL,
    "certificateNumber" TEXT,
    "verifiedBy" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LabTest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductionPlan_orgId_idx" ON "ProductionPlan"("orgId");

-- CreateIndex
CREATE INDEX "ProductionPlan_purchaseOrderId_idx" ON "ProductionPlan"("purchaseOrderId");

-- CreateIndex
CREATE INDEX "Inventory_orgId_idx" ON "Inventory"("orgId");

-- CreateIndex
CREATE INDEX "Inventory_productId_idx" ON "Inventory"("productId");

-- CreateIndex
CREATE INDEX "Inventory_batchId_idx" ON "Inventory"("batchId");

-- CreateIndex
CREATE INDEX "NCR_orgId_idx" ON "NCR"("orgId");

-- CreateIndex
CREATE INDEX "NCR_supplierId_idx" ON "NCR"("supplierId");

-- CreateIndex
CREATE INDEX "LabTest_orgId_idx" ON "LabTest"("orgId");

-- CreateIndex
CREATE INDEX "LabTest_batchId_idx" ON "LabTest"("batchId");

-- AddForeignKey
ALTER TABLE "ProductionPlan" ADD CONSTRAINT "ProductionPlan_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionPlan" ADD CONSTRAINT "ProductionPlan_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionPlan" ADD CONSTRAINT "ProductionPlan_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inventory" ADD CONSTRAINT "Inventory_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inventory" ADD CONSTRAINT "Inventory_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inventory" ADD CONSTRAINT "Inventory_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inventory" ADD CONSTRAINT "Inventory_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "Lot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inventory" ADD CONSTRAINT "Inventory_reservedForDealId_fkey" FOREIGN KEY ("reservedForDealId") REFERENCES "Deal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NCR" ADD CONSTRAINT "NCR_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NCR" ADD CONSTRAINT "NCR_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NCR" ADD CONSTRAINT "NCR_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NCR" ADD CONSTRAINT "NCR_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NCR" ADD CONSTRAINT "NCR_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "Lot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabTest" ADD CONSTRAINT "LabTest_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabTest" ADD CONSTRAINT "LabTest_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "Inspection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabTest" ADD CONSTRAINT "LabTest_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabTest" ADD CONSTRAINT "LabTest_verifiedBy_fkey" FOREIGN KEY ("verifiedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============ RLS: عزل orgId على الأربعة (بلا Trigger — مفيش قيد عمل حرج صريح في الـERD) ============
ALTER TABLE "ProductionPlan" ENABLE ROW LEVEL SECURITY;
CREATE POLICY production_plan_org_isolation ON "ProductionPlan"
  FOR ALL USING ("orgId" = current_org_id()) WITH CHECK ("orgId" = current_org_id());

ALTER TABLE "Inventory" ENABLE ROW LEVEL SECURITY;
CREATE POLICY inventory_org_isolation ON "Inventory"
  FOR ALL USING ("orgId" = current_org_id()) WITH CHECK ("orgId" = current_org_id());

ALTER TABLE "NCR" ENABLE ROW LEVEL SECURITY;
CREATE POLICY ncr_org_isolation ON "NCR"
  FOR ALL USING ("orgId" = current_org_id()) WITH CHECK ("orgId" = current_org_id());

ALTER TABLE "LabTest" ENABLE ROW LEVEL SECURITY;
CREATE POLICY lab_test_org_isolation ON "LabTest"
  FOR ALL USING ("orgId" = current_org_id()) WITH CHECK ("orgId" = current_org_id());

