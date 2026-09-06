-- CreateEnum
CREATE TYPE "SupplierAuditDecision" AS ENUM ('Approved', 'ConditionalApproval', 'Rejected');

-- CreateEnum
CREATE TYPE "SupplyContractType" AS ENUM ('Framework', 'TollProcessing', 'FarmingContract', 'ExclusiveSupply', 'SeasonalContract', 'SpotAgreement');

-- CreateEnum
CREATE TYPE "SupplyContractStatus" AS ENUM ('Draft', 'UnderNegotiation', 'Active', 'Expired', 'Terminated');

-- CreateEnum
CREATE TYPE "PackagingMaterialType" AS ENUM ('Carton', 'Bag', 'Label', 'Jar', 'Bottle', 'Pallet', 'StretchFilm', 'Strap', 'InnerLiner', 'Divider');

-- CreateEnum
CREATE TYPE "PackagingMaterialStatus" AS ENUM ('Requested', 'Ordered', 'PartiallyReceived', 'Received', 'Accepted', 'Rejected');

-- CreateEnum
CREATE TYPE "SupplierSamplePurpose" AS ENUM ('Qualification', 'PrePurchase', 'Production', 'Retention', 'Customer', 'Laboratory', 'Shipment');

-- CreateEnum
CREATE TYPE "SupplierSampleResult" AS ENUM ('Pending', 'Approved', 'Conditional', 'Rejected');

-- CreateEnum
CREATE TYPE "SupplierSampleStatus" AS ENUM ('Requested', 'Sent', 'Received', 'Evaluated', 'Closed');

-- CreateEnum
CREATE TYPE "CargoReadinessStatus" AS ENUM ('NotStarted', 'MaterialsPending', 'InProduction', 'QualityHold', 'PartialReady', 'ReadyWithConditions', 'CargoReady', 'LoadingReleased', 'Blocked', 'Cancelled');

-- CreateEnum
CREATE TYPE "SupplierPerformanceClassification" AS ENUM ('Strategic', 'Preferred', 'Approved', 'Conditional', 'ImprovementRequired', 'Suspended', 'ExitRecommended');

-- AlterTable
ALTER TABLE "LabTest" ADD COLUMN     "supplierSampleId" UUID;

-- CreateTable
CREATE TABLE "SupplierAudit" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "orgId" UUID NOT NULL,
    "supplierId" UUID NOT NULL,
    "facilityId" UUID,
    "auditDate" TIMESTAMP(3),
    "auditor" TEXT,
    "totalScore" DECIMAL(5,2),
    "criticalFindings" INTEGER,
    "majorFindings" INTEGER,
    "minorFindings" INTEGER,
    "decision" "SupplierAuditDecision" NOT NULL,
    "followUpDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplyContract" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "orgId" UUID NOT NULL,
    "supplierId" UUID NOT NULL,
    "contractType" "SupplyContractType" NOT NULL,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "priceAdjustmentMechanism" TEXT,
    "forceMajeureClause" TEXT,
    "penaltyTerms" TEXT,
    "status" "SupplyContractStatus" NOT NULL DEFAULT 'Draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplyContract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PackagingMaterial" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "orgId" UUID NOT NULL,
    "supplierId" UUID NOT NULL,
    "materialType" "PackagingMaterialType" NOT NULL,
    "specification" TEXT,
    "dimensions" TEXT,
    "artworkVersion" TEXT,
    "artworkApproved" BOOLEAN NOT NULL DEFAULT false,
    "minimumOrder" DECIMAL(14,3),
    "leadTimeDays" INTEGER,
    "quantityOrdered" DECIMAL(14,3),
    "quantityReceived" DECIMAL(14,3),
    "quantityAccepted" DECIMAL(14,3),
    "unitCost" DECIMAL(14,4),
    "currency" TEXT,
    "status" "PackagingMaterialStatus" NOT NULL DEFAULT 'Requested',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PackagingMaterial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierSample" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "orgId" UUID NOT NULL,
    "supplierId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "batchId" UUID,
    "purpose" "SupplierSamplePurpose" NOT NULL,
    "quantity" DECIMAL(14,3),
    "cost" DECIMAL(14,2),
    "currency" TEXT,
    "result" "SupplierSampleResult" NOT NULL DEFAULT 'Pending',
    "status" "SupplierSampleStatus" NOT NULL DEFAULT 'Requested',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierSample_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CargoReadiness" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "orgId" UUID NOT NULL,
    "shipmentId" UUID NOT NULL,
    "purchaseOrderId" UUID NOT NULL,
    "readinessScore" DECIMAL(5,2),
    "status" "CargoReadinessStatus" NOT NULL DEFAULT 'NotStarted',
    "blockingIssues" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "readyDate" TIMESTAMP(3),
    "pickupLocation" TEXT,
    "handoverPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CargoReadiness_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierPerformance" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "orgId" UUID NOT NULL,
    "supplierId" UUID NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "qualityPassRate" DECIMAL(5,2),
    "rejectionRate" DECIMAL(5,2),
    "onTimeDeliveryRate" DECIMAL(5,2),
    "yieldAccuracy" DECIMAL(5,2),
    "priceAccuracy" DECIMAL(5,2),
    "overallScore" DECIMAL(5,2),
    "classification" "SupplierPerformanceClassification",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierPerformance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SupplierAudit_orgId_idx" ON "SupplierAudit"("orgId");

-- CreateIndex
CREATE INDEX "SupplierAudit_supplierId_idx" ON "SupplierAudit"("supplierId");

-- CreateIndex
CREATE INDEX "SupplyContract_orgId_idx" ON "SupplyContract"("orgId");

-- CreateIndex
CREATE INDEX "SupplyContract_supplierId_idx" ON "SupplyContract"("supplierId");

-- CreateIndex
CREATE INDEX "PackagingMaterial_orgId_idx" ON "PackagingMaterial"("orgId");

-- CreateIndex
CREATE INDEX "PackagingMaterial_supplierId_idx" ON "PackagingMaterial"("supplierId");

-- CreateIndex
CREATE INDEX "SupplierSample_orgId_idx" ON "SupplierSample"("orgId");

-- CreateIndex
CREATE INDEX "SupplierSample_supplierId_idx" ON "SupplierSample"("supplierId");

-- CreateIndex
CREATE INDEX "CargoReadiness_orgId_idx" ON "CargoReadiness"("orgId");

-- CreateIndex
CREATE INDEX "CargoReadiness_shipmentId_idx" ON "CargoReadiness"("shipmentId");

-- CreateIndex
CREATE INDEX "CargoReadiness_purchaseOrderId_idx" ON "CargoReadiness"("purchaseOrderId");

-- CreateIndex
CREATE INDEX "SupplierPerformance_orgId_idx" ON "SupplierPerformance"("orgId");

-- CreateIndex
CREATE INDEX "SupplierPerformance_supplierId_idx" ON "SupplierPerformance"("supplierId");

-- AddForeignKey
ALTER TABLE "LabTest" ADD CONSTRAINT "LabTest_supplierSampleId_fkey" FOREIGN KEY ("supplierSampleId") REFERENCES "SupplierSample"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierAudit" ADD CONSTRAINT "SupplierAudit_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierAudit" ADD CONSTRAINT "SupplierAudit_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierAudit" ADD CONSTRAINT "SupplierAudit_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplyContract" ADD CONSTRAINT "SupplyContract_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplyContract" ADD CONSTRAINT "SupplyContract_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackagingMaterial" ADD CONSTRAINT "PackagingMaterial_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackagingMaterial" ADD CONSTRAINT "PackagingMaterial_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierSample" ADD CONSTRAINT "SupplierSample_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierSample" ADD CONSTRAINT "SupplierSample_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierSample" ADD CONSTRAINT "SupplierSample_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierSample" ADD CONSTRAINT "SupplierSample_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CargoReadiness" ADD CONSTRAINT "CargoReadiness_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CargoReadiness" ADD CONSTRAINT "CargoReadiness_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CargoReadiness" ADD CONSTRAINT "CargoReadiness_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierPerformance" ADD CONSTRAINT "SupplierPerformance_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierPerformance" ADD CONSTRAINT "SupplierPerformance_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============ RLS: عزل orgId على الستة (بلا Trigger — مفيش قيد عمل حرج صريح في الـERD) ============
ALTER TABLE "SupplierAudit" ENABLE ROW LEVEL SECURITY;
CREATE POLICY supplier_audit_org_isolation ON "SupplierAudit"
  FOR ALL USING ("orgId" = current_org_id()) WITH CHECK ("orgId" = current_org_id());

ALTER TABLE "SupplyContract" ENABLE ROW LEVEL SECURITY;
CREATE POLICY supply_contract_org_isolation ON "SupplyContract"
  FOR ALL USING ("orgId" = current_org_id()) WITH CHECK ("orgId" = current_org_id());

ALTER TABLE "PackagingMaterial" ENABLE ROW LEVEL SECURITY;
CREATE POLICY packaging_material_org_isolation ON "PackagingMaterial"
  FOR ALL USING ("orgId" = current_org_id()) WITH CHECK ("orgId" = current_org_id());

ALTER TABLE "SupplierSample" ENABLE ROW LEVEL SECURITY;
CREATE POLICY supplier_sample_org_isolation ON "SupplierSample"
  FOR ALL USING ("orgId" = current_org_id()) WITH CHECK ("orgId" = current_org_id());

ALTER TABLE "CargoReadiness" ENABLE ROW LEVEL SECURITY;
CREATE POLICY cargo_readiness_org_isolation ON "CargoReadiness"
  FOR ALL USING ("orgId" = current_org_id()) WITH CHECK ("orgId" = current_org_id());

ALTER TABLE "SupplierPerformance" ENABLE ROW LEVEL SECURITY;
CREATE POLICY supplier_performance_org_isolation ON "SupplierPerformance"
  FOR ALL USING ("orgId" = current_org_id()) WITH CHECK ("orgId" = current_org_id());

