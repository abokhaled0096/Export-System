-- CreateEnum
CREATE TYPE "SalesTargetType" AS ENUM ('Revenue', 'Volume', 'DealsCount');

-- CreateEnum
CREATE TYPE "CommissionBasis" AS ENUM ('RevenuePercent', 'GrossProfitPercent', 'Tiered', 'CollectionBased');

-- CreateEnum
CREATE TYPE "CommissionTriggerEvent" AS ENUM ('OnWon', 'OnInvoice', 'OnCollection');

-- CreateEnum
CREATE TYPE "CommissionEntryStatus" AS ENUM ('Accrued', 'Approved', 'Paid');

-- CreateEnum
CREATE TYPE "CustomerServiceCaseType" AS ENUM ('Complaint', 'Claim', 'QualityIssue', 'Shortage', 'Damage', 'LateShipment', 'WrongDocumentation');

-- CreateEnum
CREATE TYPE "CustomerServiceCaseStatus" AS ENUM ('Open', 'Investigating', 'PendingCustomer', 'Resolved', 'Closed');

-- CreateTable
CREATE TABLE "LeadAssignmentRule" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "orgId" UUID NOT NULL,
    "criteria" JSONB,
    "assignToUserId" UUID,
    "assignToTeamId" UUID,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadAssignmentRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesTarget" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "orgId" UUID NOT NULL,
    "userId" UUID,
    "teamId" UUID,
    "period" TEXT NOT NULL,
    "targetType" "SalesTargetType" NOT NULL,
    "targetValue" DECIMAL(14,2) NOT NULL,
    "currency" CHAR(3),
    "actualValue" DECIMAL(14,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesTarget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommissionPlan" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "orgId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "basis" "CommissionBasis" NOT NULL,
    "ratePct" DECIMAL(5,2),
    "tiers" JSONB,
    "triggerEvent" "CommissionTriggerEvent" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommissionPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommissionEntry" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "orgId" UUID NOT NULL,
    "planId" UUID NOT NULL,
    "dealId" UUID,
    "salesOrderId" UUID,
    "userId" UUID NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" CHAR(3),
    "status" "CommissionEntryStatus" NOT NULL DEFAULT 'Accrued',
    "journalEntryId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommissionEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerServiceCase" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "orgId" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "caseType" "CustomerServiceCaseType" NOT NULL,
    "slaDeadline" TIMESTAMP(3),
    "ownerId" UUID NOT NULL,
    "rootCause" TEXT,
    "capaId" UUID,
    "compensationAmount" DECIMAL(14,2),
    "currency" CHAR(3),
    "status" "CustomerServiceCaseStatus" NOT NULL DEFAULT 'Open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerServiceCase_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LeadAssignmentRule_orgId_idx" ON "LeadAssignmentRule"("orgId");

-- CreateIndex
CREATE INDEX "SalesTarget_orgId_idx" ON "SalesTarget"("orgId");

-- CreateIndex
CREATE INDEX "CommissionPlan_orgId_idx" ON "CommissionPlan"("orgId");

-- CreateIndex
CREATE INDEX "CommissionEntry_orgId_idx" ON "CommissionEntry"("orgId");

-- CreateIndex
CREATE INDEX "CommissionEntry_dealId_idx" ON "CommissionEntry"("dealId");

-- CreateIndex
CREATE INDEX "CommissionEntry_planId_idx" ON "CommissionEntry"("planId");

-- CreateIndex
CREATE INDEX "CustomerServiceCase_orgId_idx" ON "CustomerServiceCase"("orgId");

-- CreateIndex
CREATE INDEX "CustomerServiceCase_companyId_idx" ON "CustomerServiceCase"("companyId");

-- AddForeignKey
ALTER TABLE "LeadAssignmentRule" ADD CONSTRAINT "LeadAssignmentRule_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadAssignmentRule" ADD CONSTRAINT "LeadAssignmentRule_assignToUserId_fkey" FOREIGN KEY ("assignToUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadAssignmentRule" ADD CONSTRAINT "LeadAssignmentRule_assignToTeamId_fkey" FOREIGN KEY ("assignToTeamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesTarget" ADD CONSTRAINT "SalesTarget_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesTarget" ADD CONSTRAINT "SalesTarget_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesTarget" ADD CONSTRAINT "SalesTarget_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionPlan" ADD CONSTRAINT "CommissionPlan_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionEntry" ADD CONSTRAINT "CommissionEntry_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionEntry" ADD CONSTRAINT "CommissionEntry_planId_fkey" FOREIGN KEY ("planId") REFERENCES "CommissionPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionEntry" ADD CONSTRAINT "CommissionEntry_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionEntry" ADD CONSTRAINT "CommissionEntry_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionEntry" ADD CONSTRAINT "CommissionEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerServiceCase" ADD CONSTRAINT "CustomerServiceCase_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerServiceCase" ADD CONSTRAINT "CustomerServiceCase_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerServiceCase" ADD CONSTRAINT "CustomerServiceCase_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerServiceCase" ADD CONSTRAINT "CustomerServiceCase_capaId_fkey" FOREIGN KEY ("capaId") REFERENCES "CAPA"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- RLS: عزل org لكل جدول جديد
ALTER TABLE "LeadAssignmentRule" ENABLE ROW LEVEL SECURITY;
CREATE POLICY leadassignmentrule_org_isolation ON "LeadAssignmentRule" FOR ALL USING ("orgId" = current_org_id()) WITH CHECK ("orgId" = current_org_id());

ALTER TABLE "SalesTarget" ENABLE ROW LEVEL SECURITY;
CREATE POLICY salestarget_org_isolation ON "SalesTarget" FOR ALL USING ("orgId" = current_org_id()) WITH CHECK ("orgId" = current_org_id());

ALTER TABLE "CommissionPlan" ENABLE ROW LEVEL SECURITY;
CREATE POLICY commissionplan_org_isolation ON "CommissionPlan" FOR ALL USING ("orgId" = current_org_id()) WITH CHECK ("orgId" = current_org_id());

ALTER TABLE "CommissionEntry" ENABLE ROW LEVEL SECURITY;
CREATE POLICY commissionentry_org_isolation ON "CommissionEntry" FOR ALL USING ("orgId" = current_org_id()) WITH CHECK ("orgId" = current_org_id());

ALTER TABLE "CustomerServiceCase" ENABLE ROW LEVEL SECURITY;
CREATE POLICY customerservicecase_org_isolation ON "CustomerServiceCase" FOR ALL USING ("orgId" = current_org_id()) WITH CHECK ("orgId" = current_org_id());
