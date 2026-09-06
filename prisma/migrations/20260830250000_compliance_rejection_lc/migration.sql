-- CreateEnum
CREATE TYPE "RejectionType" AS ENUM ('DocumentRejection', 'SampleRejection', 'TestFailure', 'LabelRejection', 'CustomsHold', 'OriginRejection', 'HSDispute', 'HealthRejection', 'WeightMismatch');

-- CreateEnum
CREATE TYPE "RejectionSeverity" AS ENUM ('Low', 'Medium', 'High', 'Critical');

-- CreateEnum
CREATE TYPE "RejectionCaseStatus" AS ENUM ('Open', 'UnderInvestigation', 'CAPARequired', 'Resolved', 'Closed', 'Disputed');

-- CreateTable
CREATE TABLE "RejectionCase" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "orgId" UUID NOT NULL,
    "complianceCaseId" UUID NOT NULL,
    "rejectionType" "RejectionType" NOT NULL,
    "authority" TEXT NOT NULL,
    "severity" "RejectionSeverity" NOT NULL,
    "financialExposure" DECIMAL(14,2),
    "currency" TEXT,
    "status" "RejectionCaseStatus" NOT NULL DEFAULT 'Open',
    "finalResult" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RejectionCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LCRequirement" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "orgId" UUID NOT NULL,
    "dealId" UUID NOT NULL,
    "lcNumber" TEXT NOT NULL,
    "issuingBank" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "expiryDate" TIMESTAMP(3) NOT NULL,
    "latestShipmentDate" TIMESTAMP(3),
    "presentationPeriodDays" INTEGER,
    "requiredDocuments" TEXT[],
    "requiredWording" TEXT,
    "partialShipmentAllowed" BOOLEAN NOT NULL DEFAULT false,
    "transshipmentAllowed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LCRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RejectionCase_orgId_idx" ON "RejectionCase"("orgId");

-- CreateIndex
CREATE INDEX "RejectionCase_complianceCaseId_idx" ON "RejectionCase"("complianceCaseId");

-- CreateIndex
CREATE INDEX "LCRequirement_orgId_idx" ON "LCRequirement"("orgId");

-- CreateIndex
CREATE INDEX "LCRequirement_dealId_idx" ON "LCRequirement"("dealId");

-- AddForeignKey
ALTER TABLE "RejectionCase" ADD CONSTRAINT "RejectionCase_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RejectionCase" ADD CONSTRAINT "RejectionCase_complianceCaseId_fkey" FOREIGN KEY ("complianceCaseId") REFERENCES "ComplianceCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LCRequirement" ADD CONSTRAINT "LCRequirement_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LCRequirement" ADD CONSTRAINT "LCRequirement_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

