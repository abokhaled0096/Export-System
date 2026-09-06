-- uuidv7() compatibility shim for Postgres < 18 (local dev / pre-upgrade environments).
-- على Postgres 18+ (الهدف الإنتاجي، Supabase) الدالة الأصلية في pg_catalog بتتقدم دايمًا
-- في الـsearch_path، فالدالة دي هتتجاهل تلقائيًا ومش هتتنفذ خالص هناك — الاستبدال آمن.
-- المصدر: تطبيق شائع لـRFC 9562 uuidv7 بلغة plpgsql (timestamp(48) + version + random + variant).
CREATE OR REPLACE FUNCTION uuidv7() RETURNS uuid
AS $$
BEGIN
  RETURN encode(
    set_bit(
      set_bit(
        overlay(uuid_send(gen_random_uuid()) placing
          substring(int8send(floor(extract(epoch FROM clock_timestamp()) * 1000)::bigint) FROM 3)
          FROM 1 FOR 6),
        52, 1),
      53, 1),
    'hex')::uuid;
END
$$ LANGUAGE plpgsql VOLATILE;

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SalesRep', 'SalesManager', 'Finance', 'ComplianceOfficer', 'ProcurementOfficer', 'QualityManager', 'LogisticsOfficer', 'CompanyOwner', 'Admin');

-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('Draft', 'Verified', 'NeedsReview');

-- CreateEnum
CREATE TYPE "PmaRecommendation" AS ENUM ('Start', 'Study', 'Monitor', 'Avoid');

-- CreateEnum
CREATE TYPE "CompanyStatus" AS ENUM ('Lead', 'Suspect', 'Prospect', 'Qualified', 'ActiveOpportunity', 'Customer', 'RepeatCustomer', 'StrategicAccount', 'Dormant', 'Rejected', 'Blacklisted');

-- CreateEnum
CREATE TYPE "DecisionRole" AS ENUM ('DecisionMaker', 'EconomicBuyer', 'TechnicalEvaluator', 'User', 'Procurement', 'Finance', 'Quality', 'Logistics', 'Gatekeeper', 'Influencer', 'Champion', 'Opponent', 'Unknown');

-- CreateEnum
CREATE TYPE "OpportunityStage" AS ENUM ('NewLead', 'Contacted', 'Qualified', 'QuoteSent', 'Won', 'Lost');

-- CreateTable
CREATE TABLE "Organization" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "name" TEXT NOT NULL,
    "legalName" TEXT NOT NULL,
    "taxId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "orgId" UUID NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "orgId" UUID NOT NULL,
    "userId" UUID,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" UUID NOT NULL,
    "beforeValue" JSONB,
    "afterValue" JSONB,
    "ipAddress" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "orgId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "nameAr" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "hsCode" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "originCountry" TEXT NOT NULL,
    "harvestSeason" TEXT,
    "availableMonths" INTEGER[],
    "storageTempC" DECIMAL(5,2),
    "shelfLifeDays" INTEGER,
    "requiresRefrigeration" BOOLEAN NOT NULL DEFAULT false,
    "status" "ProductStatus" NOT NULL DEFAULT 'Draft',

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Market" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "orgId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "countryNameAr" TEXT NOT NULL,
    "countryNameEn" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "continent" TEXT NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "mainPorts" TEXT[],
    "tradeAgreement" TEXT,
    "politicalRiskScore" INTEGER,
    "logisticsRiskScore" INTEGER,
    "lastReviewedAt" TIMESTAMP(3),

    CONSTRAINT "Market_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductMarketAnalysis" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "orgId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "productId" UUID NOT NULL,
    "marketId" UUID NOT NULL,
    "year" INTEGER NOT NULL,
    "opportunityScore" INTEGER NOT NULL,
    "riskScore" INTEGER NOT NULL,
    "confidenceLevel" INTEGER,
    "recommendation" "PmaRecommendation" NOT NULL,

    CONSTRAINT "ProductMarketAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Company" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "orgId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "legalName" TEXT NOT NULL,
    "tradeName" TEXT,
    "country" TEXT NOT NULL,
    "city" TEXT,
    "classification" TEXT[],
    "status" "CompanyStatus" NOT NULL DEFAULT 'Lead',
    "ownerId" UUID,
    "bankAccountName" BYTEA,
    "bankIBAN" BYTEA,
    "bankSWIFT" BYTEA,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contact" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "orgId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "companyId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT,
    "email" TEXT,
    "phone" BYTEA,
    "decisionRole" "DecisionRole",

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Opportunity" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "orgId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "companyId" UUID NOT NULL,
    "contactId" UUID,
    "productId" UUID NOT NULL,
    "marketId" UUID NOT NULL,
    "stage" "OpportunityStage" NOT NULL DEFAULT 'NewLead',
    "expectedValue" DECIMAL(14,2),
    "currency" CHAR(3),
    "probabilityOfClose" INTEGER,
    "expectedCloseDate" TIMESTAMP(3),
    "ownerId" UUID,
    "nextAction" TEXT,
    "nextActionDate" TIMESTAMP(3),
    "indicativeQuantity" DECIMAL(14,3),
    "indicativeIncoterm" TEXT,
    "indicativePaymentTerms" TEXT,

    CONSTRAINT "Opportunity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_orgId_idx" ON "User"("orgId");

-- CreateIndex
CREATE INDEX "AuditLog_orgId_idx" ON "AuditLog"("orgId");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "Product_orgId_idx" ON "Product"("orgId");

-- CreateIndex
CREATE INDEX "Market_orgId_idx" ON "Market"("orgId");

-- CreateIndex
CREATE INDEX "ProductMarketAnalysis_orgId_idx" ON "ProductMarketAnalysis"("orgId");

-- CreateIndex
CREATE INDEX "ProductMarketAnalysis_productId_marketId_idx" ON "ProductMarketAnalysis"("productId", "marketId");

-- CreateIndex
CREATE INDEX "Company_orgId_idx" ON "Company"("orgId");

-- CreateIndex
CREATE INDEX "Contact_orgId_idx" ON "Contact"("orgId");

-- CreateIndex
CREATE INDEX "Contact_companyId_idx" ON "Contact"("companyId");

-- CreateIndex
CREATE INDEX "Opportunity_orgId_idx" ON "Opportunity"("orgId");

-- CreateIndex
CREATE INDEX "Opportunity_companyId_idx" ON "Opportunity"("companyId");

-- CreateIndex
CREATE INDEX "Opportunity_stage_idx" ON "Opportunity"("stage");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Market" ADD CONSTRAINT "Market_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductMarketAnalysis" ADD CONSTRAINT "ProductMarketAnalysis_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductMarketAnalysis" ADD CONSTRAINT "ProductMarketAnalysis_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Company" ADD CONSTRAINT "Company_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Company" ADD CONSTRAINT "Company_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
