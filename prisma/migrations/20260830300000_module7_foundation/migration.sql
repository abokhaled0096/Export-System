-- وحدة 7 — التوريد والإنتاج والجودة (ESPPQC): الشريحة الأولى (30 أغسطس). Supplier/Facility/
-- SourcingRequest/SupplierQuote/PurchaseOrder (5 من 23 كيان، راجع docs/ERD.md §10 وdocs/SCOPE-P7.md).
-- Supplier.bankAccountName/bankIBAN عمودين BYTEA (Bytes? في Prisma) مشفّرين عموديًا من هنا فصاعدًا
-- (بيانات بنكية 🔒)، بلا واجهة إدخال في هذه الشريحة — نفس نمط Company.bankAccountName.

-- CreateEnum
CREATE TYPE "SupplierStatus" AS ENUM ('Identified', 'Contacted', 'UnderReview', 'DocumentsPending', 'AuditRequired', 'SampleRequired', 'Conditional', 'Approved', 'Preferred', 'Suspended', 'Rejected', 'Blacklisted', 'Archived');

-- CreateEnum
CREATE TYPE "FacilityType" AS ENUM ('Farm', 'Field', 'CollectionCenter', 'PackingHouse', 'Factory', 'FreezingFacility', 'DryingFacility', 'ProcessingFacility', 'Warehouse', 'ColdStore', 'Laboratory');

-- CreateEnum
CREATE TYPE "FacilityStatus" AS ENUM ('Active', 'UnderReview', 'Suspended', 'Closed');

-- CreateEnum
CREATE TYPE "SourcingRequestStatus" AS ENUM ('Draft', 'Approved', 'RFQPreparation', 'RFQSent', 'QuotesReceived', 'UnderEvaluation', 'Negotiation', 'SupplierSelected', 'POIssued', 'Cancelled', 'Closed');

-- CreateEnum
CREATE TYPE "PurchaseOrderStatus" AS ENUM ('Draft', 'PendingApproval', 'Approved', 'Sent', 'Acknowledged', 'PartiallyConfirmed', 'Confirmed', 'InProduction', 'PartiallyDelivered', 'Delivered', 'Closed', 'Cancelled', 'Disputed');

-- CreateTable
CREATE TABLE "Supplier" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "orgId" UUID NOT NULL,
    "legalName" TEXT NOT NULL,
    "tradeName" TEXT,
    "country" TEXT,
    "governorate" TEXT,
    "city" TEXT,
    "taxId" TEXT,
    "commercialRegNo" TEXT,
    "supplierType" TEXT[],
    "status" "SupplierStatus" NOT NULL DEFAULT 'Identified',
    "bankAccountName" BYTEA,
    "bankIBAN" BYTEA,
    "bankVerifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Facility" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "orgId" UUID NOT NULL,
    "supplierId" UUID NOT NULL,
    "facilityType" "FacilityType" NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "capacityDaily" DECIMAL(12,2),
    "productionLines" INTEGER,
    "shifts" INTEGER,
    "hasTraceabilitySystem" BOOLEAN NOT NULL DEFAULT false,
    "lastAuditAt" TIMESTAMP(3),
    "status" "FacilityStatus" NOT NULL DEFAULT 'UnderReview',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Facility_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourcingRequest" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "orgId" UUID NOT NULL,
    "dealId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "marketId" UUID NOT NULL,
    "rawQuantityRequired" DECIMAL(14,3),
    "saleableQuantityRequired" DECIMAL(14,3),
    "maximumPurchasePrice" DECIMAL(14,4) NOT NULL,
    "targetPurchasePrice" DECIMAL(14,4),
    "currency" TEXT NOT NULL,
    "requiredCargoReadyDate" TIMESTAMP(3),
    "status" "SourcingRequestStatus" NOT NULL DEFAULT 'Draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SourcingRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierQuote" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "orgId" UUID NOT NULL,
    "sourcingRequestId" UUID NOT NULL,
    "supplierId" UUID NOT NULL,
    "unitPrice" DECIMAL(14,4) NOT NULL,
    "priceUnit" TEXT,
    "currency" TEXT NOT NULL,
    "fxRateId" UUID,
    "packagingIncluded" BOOLEAN NOT NULL DEFAULT false,
    "transportIncluded" BOOLEAN NOT NULL DEFAULT false,
    "paymentTerms" TEXT,
    "leadTimeDays" INTEGER,
    "availableQuantity" DECIMAL(14,3),
    "minimumOrder" DECIMAL(14,3),
    "expectedYield" DECIMAL(5,4),
    "totalEffectiveCost" DECIMAL(14,2),
    "validUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierQuote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrder" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "orgId" UUID NOT NULL,
    "sourcingRequestId" UUID NOT NULL,
    "supplierId" UUID NOT NULL,
    "facilityId" UUID,
    "poNumber" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "quantity" DECIMAL(14,3) NOT NULL,
    "unitPrice" DECIMAL(14,4) NOT NULL,
    "currency" TEXT NOT NULL,
    "fxRateId" UUID,
    "deliverySchedule" JSONB,
    "paymentTerms" TEXT,
    "penalties" TEXT,
    "status" "PurchaseOrderStatus" NOT NULL DEFAULT 'Draft',
    "approvalId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Supplier_orgId_idx" ON "Supplier"("orgId");

-- CreateIndex
CREATE INDEX "Facility_orgId_idx" ON "Facility"("orgId");

-- CreateIndex
CREATE INDEX "Facility_supplierId_idx" ON "Facility"("supplierId");

-- CreateIndex
CREATE INDEX "SourcingRequest_orgId_idx" ON "SourcingRequest"("orgId");

-- CreateIndex
CREATE INDEX "SourcingRequest_dealId_idx" ON "SourcingRequest"("dealId");

-- CreateIndex
CREATE INDEX "SupplierQuote_orgId_idx" ON "SupplierQuote"("orgId");

-- CreateIndex
CREATE INDEX "SupplierQuote_sourcingRequestId_idx" ON "SupplierQuote"("sourcingRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrder_poNumber_key" ON "PurchaseOrder"("poNumber");

-- CreateIndex
CREATE INDEX "PurchaseOrder_orgId_idx" ON "PurchaseOrder"("orgId");

-- CreateIndex
CREATE INDEX "PurchaseOrder_sourcingRequestId_idx" ON "PurchaseOrder"("sourcingRequestId");

-- AddForeignKey
ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Facility" ADD CONSTRAINT "Facility_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Facility" ADD CONSTRAINT "Facility_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourcingRequest" ADD CONSTRAINT "SourcingRequest_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourcingRequest" ADD CONSTRAINT "SourcingRequest_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourcingRequest" ADD CONSTRAINT "SourcingRequest_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourcingRequest" ADD CONSTRAINT "SourcingRequest_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierQuote" ADD CONSTRAINT "SupplierQuote_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierQuote" ADD CONSTRAINT "SupplierQuote_sourcingRequestId_fkey" FOREIGN KEY ("sourcingRequestId") REFERENCES "SourcingRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierQuote" ADD CONSTRAINT "SupplierQuote_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierQuote" ADD CONSTRAINT "SupplierQuote_fxRateId_fkey" FOREIGN KEY ("fxRateId") REFERENCES "ExchangeRate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_sourcingRequestId_fkey" FOREIGN KEY ("sourcingRequestId") REFERENCES "SourcingRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_fxRateId_fkey" FOREIGN KEY ("fxRateId") REFERENCES "ExchangeRate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_approvalId_fkey" FOREIGN KEY ("approvalId") REFERENCES "Approval"("id") ON DELETE SET NULL ON UPDATE CASCADE;
