-- CreateEnum
CREATE TYPE "TemplateStatus" AS ENUM ('Draft', 'Approved', 'Archived');

-- CreateEnum
CREATE TYPE "DocumentPackageType" AS ENUM ('QuotationPack', 'FirstOrderPack', 'ShipmentPack', 'SamplePack', 'TenderPack');

-- CreateEnum
CREATE TYPE "DocumentPackageStatus" AS ENUM ('NotStarted', 'InProgress', 'MissingData', 'UnderReview', 'Complete', 'Issued', 'Sent');

-- CreateEnum
CREATE TYPE "ClauseCategory" AS ENUM ('Payment', 'Delivery', 'Quality', 'Claims', 'ForceMajeure', 'GoverningLaw', 'Confidentiality', 'Cancellation');

-- CreateEnum
CREATE TYPE "ClauseRiskLevel" AS ENUM ('Low', 'Medium', 'High');

-- CreateTable
CREATE TABLE "DocumentVersion" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "orgId" UUID NOT NULL,
    "documentId" UUID NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "changeReason" TEXT,
    "changedFields" JSONB,
    "previousValues" JSONB,
    "newValues" JSONB,
    "contentSnapshot" JSONB,
    "createdBy" UUID NOT NULL,
    "approvalId" UUID,
    "supersededById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Template" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "orgId" UUID NOT NULL,
    "documentType" "DocumentType" NOT NULL,
    "language" "DocumentLanguage" NOT NULL DEFAULT 'Arabic',
    "marketId" UUID,
    "customerId" UUID,
    "bodySchema" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "TemplateStatus" NOT NULL DEFAULT 'Draft',
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Template_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentPackage" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "orgId" UUID NOT NULL,
    "dealId" UUID NOT NULL,
    "shipmentId" UUID,
    "packageType" "DocumentPackageType" NOT NULL,
    "status" "DocumentPackageStatus" NOT NULL DEFAULT 'NotStarted',
    "completenessScore" DECIMAL(5,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentPackage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Clause" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "orgId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "category" "ClauseCategory" NOT NULL,
    "textAr" TEXT,
    "textEn" TEXT,
    "riskLevel" "ClauseRiskLevel" NOT NULL DEFAULT 'Low',
    "approvalRequired" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Clause_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DocumentVersion_orgId_idx" ON "DocumentVersion"("orgId");

-- CreateIndex
CREATE INDEX "DocumentVersion_documentId_idx" ON "DocumentVersion"("documentId");

-- CreateIndex
CREATE INDEX "Template_orgId_idx" ON "Template"("orgId");

-- CreateIndex
CREATE INDEX "DocumentPackage_orgId_idx" ON "DocumentPackage"("orgId");

-- CreateIndex
CREATE INDEX "DocumentPackage_dealId_idx" ON "DocumentPackage"("dealId");

-- CreateIndex
CREATE INDEX "Clause_orgId_idx" ON "Clause"("orgId");

-- AddForeignKey
ALTER TABLE "DocumentVersion" ADD CONSTRAINT "DocumentVersion_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentVersion" ADD CONSTRAINT "DocumentVersion_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentVersion" ADD CONSTRAINT "DocumentVersion_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentVersion" ADD CONSTRAINT "DocumentVersion_approvalId_fkey" FOREIGN KEY ("approvalId") REFERENCES "Approval"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentVersion" ADD CONSTRAINT "DocumentVersion_supersededById_fkey" FOREIGN KEY ("supersededById") REFERENCES "DocumentVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Template" ADD CONSTRAINT "Template_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Template" ADD CONSTRAINT "Template_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Template" ADD CONSTRAINT "Template_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentPackage" ADD CONSTRAINT "DocumentPackage_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentPackage" ADD CONSTRAINT "DocumentPackage_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentPackage" ADD CONSTRAINT "DocumentPackage_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Clause" ADD CONSTRAINT "Clause_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- RLS: عزل org لكل جدول جديد
ALTER TABLE "DocumentVersion" ENABLE ROW LEVEL SECURITY;
CREATE POLICY documentversion_org_isolation ON "DocumentVersion" FOR ALL USING ("orgId" = current_org_id()) WITH CHECK ("orgId" = current_org_id());

ALTER TABLE "Template" ENABLE ROW LEVEL SECURITY;
CREATE POLICY template_org_isolation ON "Template" FOR ALL USING ("orgId" = current_org_id()) WITH CHECK ("orgId" = current_org_id());

ALTER TABLE "DocumentPackage" ENABLE ROW LEVEL SECURITY;
CREATE POLICY documentpackage_org_isolation ON "DocumentPackage" FOR ALL USING ("orgId" = current_org_id()) WITH CHECK ("orgId" = current_org_id());

ALTER TABLE "Clause" ENABLE ROW LEVEL SECURITY;
CREATE POLICY clause_org_isolation ON "Clause" FOR ALL USING ("orgId" = current_org_id()) WITH CHECK ("orgId" = current_org_id());
