-- CreateEnum
CREATE TYPE "ComplianceOperationType" AS ENUM ('CommercialExport', 'Sample', 'Tender', 'TrialShipment', 'AnnualContract', 'PrivateLabel');

-- CreateEnum
CREATE TYPE "ComplianceCaseStatus" AS ENUM ('Draft', 'UnderAssessment', 'MissingInformation', 'Conditional', 'Compliant', 'Hold', 'Blocked', 'ApprovedForPricing', 'ApprovedForContract', 'ApprovedForProduction', 'ApprovedForShipment', 'Closed', 'Rejected');

-- CreateEnum
CREATE TYPE "RequirementCategory" AS ENUM ('MarketAccess', 'Customs', 'Health', 'Phytosanitary', 'Quality', 'Packaging', 'Labeling', 'Origin', 'Transport', 'Banking');

-- CreateEnum
CREATE TYPE "RequirementStatus" AS ENUM ('NotApplicable', 'Applicable', 'PossiblyApplicable', 'Met', 'PartiallyMet', 'NotMet', 'Blocking', 'NeedsExpertReview');

-- CreateEnum
CREATE TYPE "GateStatus" AS ENUM ('Passed', 'PassedWithConditions', 'Pending', 'Failed', 'Waived', 'NotApplicable');

-- CreateEnum
CREATE TYPE "HSClassificationStatus" AS ENUM ('Proposed', 'UnderReview', 'ConfirmedInternally', 'ConfirmedByBroker', 'ConfirmedByRuling', 'Disputed', 'NeedsExpertReview', 'Rejected');

-- CreateEnum
CREATE TYPE "CertificateType" AS ENUM ('HACCP', 'BRCGS', 'IFS', 'FSSC', 'GlobalGAP', 'ISO', 'Organic', 'Halal', 'Kosher', 'GMP', 'Phytosanitary', 'HealthCertificate', 'COA', 'Fumigation');

-- CreateEnum
CREATE TYPE "CertificateStatus" AS ENUM ('Valid', 'ExpiringSoon', 'Expired', 'Suspended', 'UnderRenewal', 'Pending', 'Rejected', 'NotVerified');

-- CreateTable
CREATE TABLE "ComplianceCase" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "orgId" UUID NOT NULL,
    "dealId" UUID NOT NULL,
    "scenarioId" UUID,
    "productId" UUID NOT NULL,
    "marketId" UUID NOT NULL,
    "operationType" "ComplianceOperationType" NOT NULL,
    "status" "ComplianceCaseStatus" NOT NULL DEFAULT 'Draft',
    "estimatedComplianceCost" DECIMAL(14,2),
    "estimatedComplianceDays" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ComplianceCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Requirement" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "orgId" UUID NOT NULL,
    "complianceCaseId" UUID,
    "productId" UUID,
    "marketId" UUID,
    "category" "RequirementCategory" NOT NULL,
    "name" TEXT NOT NULL,
    "mandatory" BOOLEAN NOT NULL DEFAULT true,
    "status" "RequirementStatus" NOT NULL DEFAULT 'Applicable',
    "responsibleParty" TEXT,
    "issuingAuthority" TEXT,
    "estimatedCost" DECIMAL(14,2),
    "estimatedDays" INTEGER,
    "dueDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Requirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Gate" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "orgId" UUID NOT NULL,
    "complianceCaseId" UUID NOT NULL,
    "gateNumber" INTEGER NOT NULL,
    "gateName" TEXT NOT NULL,
    "status" "GateStatus" NOT NULL DEFAULT 'Pending',
    "blockingRequirementIds" TEXT[],
    "decidedBy" UUID,
    "decidedAt" TIMESTAMP(3),
    "approvalId" UUID,
    "waiverExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Gate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HSClassification" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "orgId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "marketId" UUID NOT NULL,
    "hsCode" TEXT NOT NULL,
    "status" "HSClassificationStatus" NOT NULL DEFAULT 'Proposed',
    "confidenceScore" INTEGER,
    "dutyRatePct" DECIMAL(5,2),
    "rulingReference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HSClassification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Certificate" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "orgId" UUID NOT NULL,
    "companyId" UUID,
    "productId" UUID,
    "certificateType" "CertificateType" NOT NULL,
    "certificateNumber" TEXT NOT NULL,
    "issuingAuthority" TEXT NOT NULL,
    "issueDate" TIMESTAMP(3) NOT NULL,
    "expiryDate" TIMESTAMP(3),
    "scope" TEXT,
    "marketsCovered" TEXT[],
    "status" "CertificateStatus" NOT NULL DEFAULT 'Valid',
    "renewalLeadTimeDays" INTEGER,
    "lastVerifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Certificate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ComplianceCase_orgId_idx" ON "ComplianceCase"("orgId");

-- CreateIndex
CREATE INDEX "ComplianceCase_dealId_idx" ON "ComplianceCase"("dealId");

-- CreateIndex
CREATE INDEX "Requirement_orgId_idx" ON "Requirement"("orgId");

-- CreateIndex
CREATE INDEX "Requirement_complianceCaseId_idx" ON "Requirement"("complianceCaseId");

-- CreateIndex
CREATE INDEX "Gate_orgId_idx" ON "Gate"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "Gate_complianceCaseId_gateNumber_key" ON "Gate"("complianceCaseId", "gateNumber");

-- CreateIndex
CREATE INDEX "HSClassification_orgId_idx" ON "HSClassification"("orgId");

-- CreateIndex
CREATE INDEX "HSClassification_productId_marketId_idx" ON "HSClassification"("productId", "marketId");

-- CreateIndex
CREATE INDEX "Certificate_orgId_idx" ON "Certificate"("orgId");

-- AddForeignKey
ALTER TABLE "ComplianceCase" ADD CONSTRAINT "ComplianceCase_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceCase" ADD CONSTRAINT "ComplianceCase_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceCase" ADD CONSTRAINT "ComplianceCase_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "DealScenario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceCase" ADD CONSTRAINT "ComplianceCase_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceCase" ADD CONSTRAINT "ComplianceCase_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Requirement" ADD CONSTRAINT "Requirement_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Requirement" ADD CONSTRAINT "Requirement_complianceCaseId_fkey" FOREIGN KEY ("complianceCaseId") REFERENCES "ComplianceCase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Requirement" ADD CONSTRAINT "Requirement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Requirement" ADD CONSTRAINT "Requirement_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Gate" ADD CONSTRAINT "Gate_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Gate" ADD CONSTRAINT "Gate_complianceCaseId_fkey" FOREIGN KEY ("complianceCaseId") REFERENCES "ComplianceCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Gate" ADD CONSTRAINT "Gate_decidedBy_fkey" FOREIGN KEY ("decidedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Gate" ADD CONSTRAINT "Gate_approvalId_fkey" FOREIGN KEY ("approvalId") REFERENCES "Approval"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HSClassification" ADD CONSTRAINT "HSClassification_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HSClassification" ADD CONSTRAINT "HSClassification_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HSClassification" ADD CONSTRAINT "HSClassification_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

