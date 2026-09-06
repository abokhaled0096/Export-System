-- CreateEnum
CREATE TYPE "RegistrationType" AS ENUM ('FacilityRegistration', 'ProductRegistration', 'ExporterRegistration', 'ImporterRegistration', 'LabelRegistration');

-- CreateEnum
CREATE TYPE "RegistrationStatus" AS ENUM ('NotStarted', 'CollectingDocuments', 'Submitted', 'UnderReview', 'InspectionRequired', 'Approved', 'Rejected', 'Expired', 'Suspended', 'RenewalRequired');

-- CreateEnum
CREATE TYPE "OriginProofType" AS ENUM ('EUR1', 'InvoiceDeclaration', 'StatementOnOrigin', 'CertificateOfOrigin');

-- CreateEnum
CREATE TYPE "OriginProofCumulationType" AS ENUM ('None', 'Bilateral', 'Diagonal', 'Full');

-- CreateEnum
CREATE TYPE "OriginProofStatus" AS ENUM ('Draft', 'Issued', 'Verified', 'Rejected', 'Expired');

-- AlterTable
ALTER TABLE "Gate" ADD COLUMN     "requiresOriginProofVerification" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "Registration" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "orgId" UUID NOT NULL,
    "registrationType" "RegistrationType" NOT NULL,
    "country" TEXT NOT NULL,
    "authority" TEXT NOT NULL,
    "productId" UUID,
    "registrationNumber" TEXT,
    "submissionDate" TIMESTAMP(3),
    "approvalDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "status" "RegistrationStatus" NOT NULL DEFAULT 'NotStarted',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Registration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OriginProof" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "orgId" UUID NOT NULL,
    "dealId" UUID NOT NULL,
    "proofType" "OriginProofType" NOT NULL,
    "usesRevisedPemRules" BOOLEAN NOT NULL DEFAULT false,
    "revisedRulesWordingVerified" BOOLEAN NOT NULL DEFAULT false,
    "cumulationType" "OriginProofCumulationType",
    "certificateNumber" TEXT,
    "issuedDate" TIMESTAMP(3),
    "issuingAuthority" TEXT,
    "status" "OriginProofStatus" NOT NULL DEFAULT 'Draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OriginProof_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Registration_orgId_idx" ON "Registration"("orgId");

-- CreateIndex
CREATE INDEX "OriginProof_orgId_idx" ON "OriginProof"("orgId");

-- CreateIndex
CREATE INDEX "OriginProof_dealId_idx" ON "OriginProof"("dealId");

-- AddForeignKey
ALTER TABLE "Registration" ADD CONSTRAINT "Registration_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Registration" ADD CONSTRAINT "Registration_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OriginProof" ADD CONSTRAINT "OriginProof_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OriginProof" ADD CONSTRAINT "OriginProof_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

