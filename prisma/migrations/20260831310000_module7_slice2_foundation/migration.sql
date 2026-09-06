
-- CreateEnum
CREATE TYPE "BatchQualityStatus" AS ENUM ('Pending', 'Released', 'Held', 'Rejected');

-- CreateEnum
CREATE TYPE "BatchStatus" AS ENUM ('Planned', 'InProduction', 'Completed', 'OnHold', 'Cancelled');

-- CreateEnum
CREATE TYPE "InspectionStage" AS ENUM ('PreQualification', 'IncomingRawMaterial', 'DuringProduction', 'PrePackaging', 'PackagingInspection', 'FinalProduct', 'PreLoading', 'ContainerInspection');

-- CreateEnum
CREATE TYPE "InspectionResult" AS ENUM ('Pass', 'ConditionalPass', 'Fail');

-- CreateEnum
CREATE TYPE "QualityReleaseStatus" AS ENUM ('Released', 'PartialRelease', 'ConditionalRelease', 'Held', 'Rejected');

-- CreateEnum
CREATE TYPE "LotStatus" AS ENUM ('Draft', 'Ready', 'Allocated', 'Shipped', 'Consumed', 'Cancelled');

-- CreateTable
CREATE TABLE "Batch" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "orgId" UUID NOT NULL,
    "purchaseOrderId" UUID NOT NULL,
    "facilityId" UUID NOT NULL,
    "supplierId" UUID NOT NULL,
    "batchCode" TEXT NOT NULL,
    "productionDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "quantityInput" DECIMAL(14,3) NOT NULL,
    "quantityOutput" DECIMAL(14,3),
    "qualityStatus" "BatchQualityStatus" NOT NULL DEFAULT 'Pending',
    "status" "BatchStatus" NOT NULL DEFAULT 'Planned',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Batch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Inspection" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "orgId" UUID NOT NULL,
    "stage" "InspectionStage" NOT NULL,
    "batchId" UUID NOT NULL,
    "facilityId" UUID NOT NULL,
    "inspectorId" UUID NOT NULL,
    "inspectionDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "samplingMethod" TEXT,
    "sampleSize" DECIMAL(10,2),
    "result" "InspectionResult" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Inspection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QualityRelease" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "orgId" UUID NOT NULL,
    "batchId" UUID NOT NULL,
    "lotId" UUID,
    "inspectionResults" JSONB,
    "releasedQuantity" DECIMAL(14,3),
    "rejectedQuantity" DECIMAL(14,3),
    "releaseDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "releasedBy" UUID NOT NULL,
    "status" "QualityReleaseStatus" NOT NULL DEFAULT 'Held',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QualityRelease_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lot" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "orgId" UUID NOT NULL,
    "batchId" UUID NOT NULL,
    "lotCode" TEXT NOT NULL,
    "packingDate" TIMESTAMP(3),
    "packagingVersion" TEXT,
    "labelVersion" TEXT,
    "quantity" DECIMAL(14,3),
    "cartons" INTEGER,
    "pallets" INTEGER,
    "netWeight" DECIMAL(12,3),
    "grossWeight" DECIMAL(12,3),
    "qualityStatus" "BatchQualityStatus" NOT NULL DEFAULT 'Pending',
    "status" "LotStatus" NOT NULL DEFAULT 'Draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Batch_batchCode_key" ON "Batch"("batchCode");

-- CreateIndex
CREATE INDEX "Batch_orgId_idx" ON "Batch"("orgId");

-- CreateIndex
CREATE INDEX "Batch_purchaseOrderId_idx" ON "Batch"("purchaseOrderId");

-- CreateIndex
CREATE INDEX "Inspection_orgId_idx" ON "Inspection"("orgId");

-- CreateIndex
CREATE INDEX "Inspection_batchId_idx" ON "Inspection"("batchId");

-- CreateIndex
CREATE INDEX "QualityRelease_orgId_idx" ON "QualityRelease"("orgId");

-- CreateIndex
CREATE INDEX "QualityRelease_batchId_idx" ON "QualityRelease"("batchId");

-- CreateIndex
CREATE INDEX "QualityRelease_lotId_idx" ON "QualityRelease"("lotId");

-- CreateIndex
CREATE UNIQUE INDEX "Lot_lotCode_key" ON "Lot"("lotCode");

-- CreateIndex
CREATE INDEX "Lot_orgId_idx" ON "Lot"("orgId");

-- CreateIndex
CREATE INDEX "Lot_batchId_idx" ON "Lot"("batchId");

-- AddForeignKey
ALTER TABLE "Batch" ADD CONSTRAINT "Batch_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Batch" ADD CONSTRAINT "Batch_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Batch" ADD CONSTRAINT "Batch_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Batch" ADD CONSTRAINT "Batch_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_inspectorId_fkey" FOREIGN KEY ("inspectorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QualityRelease" ADD CONSTRAINT "QualityRelease_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QualityRelease" ADD CONSTRAINT "QualityRelease_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QualityRelease" ADD CONSTRAINT "QualityRelease_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "Lot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QualityRelease" ADD CONSTRAINT "QualityRelease_releasedBy_fkey" FOREIGN KEY ("releasedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lot" ADD CONSTRAINT "Lot_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lot" ADD CONSTRAINT "Lot_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

