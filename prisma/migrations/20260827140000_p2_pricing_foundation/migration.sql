-- ============ P2 — التسعير والقرار (شريحة أولى، ERD v4 §5) ============
-- Deal, DealScenario, CostItem, Quote + 3 كيانات مشتركة لازمة كأساس (ExchangeRate,
-- ApprovalPolicy, Approval). راجع docs/SCOPE-P2.md للتأجيلات المقصودة (RiskItem, QuoteLine,
-- SalesOrder*, DealActual). Migration مولّدة بـ `prisma migrate diff --from-config-datasource
-- --to-schema prisma/schema.prisma --script` (نفس القيد الموثق في STATUS.md gotcha #12:
-- `prisma migrate dev` مش شغّال هنا بسبب غياب schema auth في الـshadow database).

-- CreateEnum
CREATE TYPE "ExchangeRateType" AS ENUM ('Spot', 'Budget', 'Contracted', 'Actual');

-- CreateEnum
CREATE TYPE "ApprovalOperator" AS ENUM ('GT', 'GTE', 'LT', 'LTE', 'EQ');

-- CreateEnum
CREATE TYPE "ApprovalDecision" AS ENUM ('Pending', 'Approved', 'Rejected', 'Escalated');

-- CreateEnum
CREATE TYPE "DealObjective" AS ENUM ('MaximizeProfit', 'NewMarketEntry', 'WinCustomer', 'ProtectAccount', 'ClearInventory', 'TestMarket');

-- CreateEnum
CREATE TYPE "DealStatus" AS ENUM ('Draft', 'Pricing', 'Negotiation', 'Approved', 'Won', 'Lost', 'Cancelled');

-- CreateEnum
CREATE TYPE "Incoterm" AS ENUM ('EXW', 'FCA', 'FAS', 'FOB', 'CFR', 'CIF', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP');

-- CreateEnum
CREATE TYPE "CostCategory" AS ENUM ('Product', 'Processing', 'Packaging', 'Quality', 'ExportLogistics', 'InternationalFreight', 'DestinationCharges', 'SellingAdmin', 'Finance', 'RiskReserve');

-- CreateEnum
CREATE TYPE "CostConfidenceLevel" AS ENUM ('Contract100', 'OfficialQuote90', 'ExpiringQuote75', 'HistoricalAvg60', 'InternalEstimate40', 'Assumption20');

-- CreateEnum
CREATE TYPE "QuoteStatus" AS ENUM ('Draft', 'PendingApproval', 'Sent', 'Accepted', 'Rejected', 'Expired', 'Superseded');

-- CreateTable
CREATE TABLE "ExchangeRate" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "orgId" UUID NOT NULL,
    "baseCurrency" CHAR(3) NOT NULL,
    "quoteCurrency" CHAR(3) NOT NULL,
    "rate" DECIMAL(18,8) NOT NULL,
    "rateDate" TIMESTAMP(3) NOT NULL,
    "rateType" "ExchangeRateType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExchangeRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalPolicy" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "orgId" UUID NOT NULL,
    "subjectType" TEXT NOT NULL,
    "conditionField" TEXT NOT NULL,
    "operator" "ApprovalOperator" NOT NULL,
    "thresholdValue" DECIMAL(14,4) NOT NULL,
    "requiredRoleId" UUID NOT NULL,
    "escalationRoleId" UUID,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApprovalPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Approval" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "orgId" UUID NOT NULL,
    "subjectType" TEXT NOT NULL,
    "subjectId" UUID NOT NULL,
    "policyId" UUID,
    "requestedBy" UUID NOT NULL,
    "decidedBy" UUID,
    "decision" "ApprovalDecision" NOT NULL DEFAULT 'Pending',
    "reason" TEXT,
    "decidedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Approval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Deal" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "orgId" UUID NOT NULL,
    "opportunityId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "marketId" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "dealObjective" "DealObjective" NOT NULL,
    "status" "DealStatus" NOT NULL DEFAULT 'Draft',
    "activeScenarioId" UUID,
    "lostReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Deal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DealScenario" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "orgId" UUID NOT NULL,
    "dealId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "scenarioName" TEXT NOT NULL,
    "quantityRaw" DECIMAL(14,3) NOT NULL,
    "yieldRate" DECIMAL(5,4),
    "quantitySaleable" DECIMAL(14,3) NOT NULL,
    "incoterm" "Incoterm" NOT NULL,
    "namedPlace" TEXT,
    "paymentTerms" TEXT,
    "advanceRatePct" DECIMAL(5,2),
    "creditDays" INTEGER,
    "currency" CHAR(3) NOT NULL,
    "fxRateId" UUID NOT NULL,
    "breakEvenPrice" DECIMAL(14,4),
    "walkAwayPrice" DECIMAL(14,4) NOT NULL,
    "targetPrice" DECIMAL(14,4),
    "openingPrice" DECIMAL(14,4),
    "finalPrice" DECIMAL(14,4),
    "expectedProfit" DECIMAL(14,2),
    "expectedMarginPct" DECIMAL(5,2),
    "expectedMarkupPct" DECIMAL(5,2),
    "financeCost" DECIMAL(14,2),
    "riskReserve" DECIMAL(14,2),
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DealScenario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CostItem" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "orgId" UUID NOT NULL,
    "scenarioId" UUID NOT NULL,
    "category" "CostCategory" NOT NULL,
    "subcategory" TEXT,
    "amount" DECIMAL(14,2) NOT NULL,
    "confidenceLevel" "CostConfidenceLevel" NOT NULL,
    "expiryDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CostItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Quote" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "orgId" UUID NOT NULL,
    "dealId" UUID NOT NULL,
    "scenarioId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "customerId" UUID NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "incoterm" "Incoterm" NOT NULL,
    "namedPlace" TEXT,
    "validUntil" TIMESTAMP(3),
    "unitPrice" DECIMAL(14,4) NOT NULL,
    "priceUnit" TEXT NOT NULL,
    "status" "QuoteStatus" NOT NULL DEFAULT 'Draft',
    "approvalId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Quote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExchangeRate_orgId_idx" ON "ExchangeRate"("orgId");

-- CreateIndex
CREATE INDEX "ApprovalPolicy_orgId_idx" ON "ApprovalPolicy"("orgId");

-- CreateIndex
CREATE INDEX "Approval_orgId_idx" ON "Approval"("orgId");

-- CreateIndex
CREATE INDEX "Approval_subjectType_subjectId_idx" ON "Approval"("subjectType", "subjectId");

-- CreateIndex
CREATE INDEX "Deal_orgId_idx" ON "Deal"("orgId");

-- CreateIndex
CREATE INDEX "Deal_opportunityId_idx" ON "Deal"("opportunityId");

-- CreateIndex
CREATE INDEX "DealScenario_orgId_idx" ON "DealScenario"("orgId");

-- CreateIndex
CREATE INDEX "DealScenario_dealId_idx" ON "DealScenario"("dealId");

-- CreateIndex
CREATE UNIQUE INDEX "DealScenario_dealId_version_key" ON "DealScenario"("dealId", "version");

-- CreateIndex
CREATE INDEX "CostItem_orgId_idx" ON "CostItem"("orgId");

-- CreateIndex
CREATE INDEX "CostItem_scenarioId_idx" ON "CostItem"("scenarioId");

-- CreateIndex
CREATE INDEX "Quote_orgId_idx" ON "Quote"("orgId");

-- CreateIndex
CREATE INDEX "Quote_scenarioId_idx" ON "Quote"("scenarioId");

-- CreateIndex
CREATE UNIQUE INDEX "Quote_dealId_version_key" ON "Quote"("dealId", "version");

-- AddForeignKey
ALTER TABLE "ExchangeRate" ADD CONSTRAINT "ExchangeRate_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalPolicy" ADD CONSTRAINT "ApprovalPolicy_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalPolicy" ADD CONSTRAINT "ApprovalPolicy_requiredRoleId_fkey" FOREIGN KEY ("requiredRoleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "ApprovalPolicy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_requestedBy_fkey" FOREIGN KEY ("requestedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_decidedBy_fkey" FOREIGN KEY ("decidedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealScenario" ADD CONSTRAINT "DealScenario_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealScenario" ADD CONSTRAINT "DealScenario_fxRateId_fkey" FOREIGN KEY ("fxRateId") REFERENCES "ExchangeRate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostItem" ADD CONSTRAINT "CostItem_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "DealScenario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "DealScenario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_approvalId_fkey" FOREIGN KEY ("approvalId") REFERENCES "Approval"("id") ON DELETE SET NULL ON UPDATE CASCADE;

