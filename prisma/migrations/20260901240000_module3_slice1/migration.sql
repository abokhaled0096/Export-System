-- CreateEnum
CREATE TYPE "CommunicationChannel" AS ENUM ('Email', 'WhatsApp', 'Phone', 'VideoMeeting', 'PhysicalMeeting', 'LinkedIn', 'WebsiteInquiry', 'Exhibition');

-- CreateEnum
CREATE TYPE "CommunicationDirection" AS ENUM ('Inbound', 'Outbound');

-- CreateEnum
CREATE TYPE "RFQSeriousnessLevel" AS ENUM ('SeriousBuyer', 'PromisingIncomplete', 'PriceShopper', 'EarlyResearch', 'LowIntent', 'SuspiciousInquiry');

-- CreateEnum
CREATE TYPE "CustomerSampleStatus" AS ENUM ('Requested', 'ApprovedInternally', 'Preparing', 'Shipped', 'InTransit', 'Delivered', 'FeedbackPending', 'Approved', 'Rejected', 'ConvertedToOrder', 'Closed');

-- CreateEnum
CREATE TYPE "NegotiationStatus" AS ENUM ('Open', 'Stalled', 'Agreed', 'Failed');

-- CreateEnum
CREATE TYPE "NegotiationConcessionType" AS ENUM ('Discount', 'Credit', 'LowerAdvance', 'SpecialPackaging', 'PrivateLabel', 'FasterShipping', 'Exclusivity', 'FreeSample', 'LowerMOQ');

-- CreateEnum
CREATE TYPE "RedFlagSeverity" AS ENUM ('Low', 'Medium', 'High', 'Critical');

-- CreateTable
CREATE TABLE "Communication" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "orgId" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "contactId" UUID,
    "opportunityId" UUID,
    "channel" "CommunicationChannel" NOT NULL,
    "direction" "CommunicationDirection" NOT NULL,
    "subject" TEXT,
    "summary" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "requiresReply" BOOLEAN NOT NULL DEFAULT false,
    "respondedAt" TIMESTAMP(3),
    "responseTimeHours" DECIMAL(10,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Communication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RFQAnalysis" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "orgId" UUID NOT NULL,
    "communicationId" UUID,
    "opportunityId" UUID NOT NULL,
    "destinationPort" TEXT,
    "paymentMethod" TEXT,
    "quantity" DECIMAL(14,3),
    "incoterm" TEXT,
    "extractedFields" JSONB,
    "completenessScore" DECIMAL(5,2),
    "seriousnessLevel" "RFQSeriousnessLevel",
    "missingFields" TEXT[],
    "suggestedQuestions" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RFQAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerSample" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "orgId" UUID NOT NULL,
    "opportunityId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "batchId" UUID,
    "quantity" DECIMAL(14,3),
    "totalCost" DECIMAL(14,2),
    "currency" CHAR(3),
    "trackingNumber" TEXT,
    "status" "CustomerSampleStatus" NOT NULL DEFAULT 'Requested',
    "feedback" TEXT,
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerSample_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Negotiation" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "orgId" UUID NOT NULL,
    "dealId" UUID,
    "opportunityId" UUID,
    "supplierId" UUID,
    "sourcingRequestId" UUID,
    "status" "NegotiationStatus" NOT NULL DEFAULT 'Open',
    "currentPrice" DECIMAL(14,4),
    "currency" CHAR(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Negotiation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NegotiationRound" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "orgId" UUID NOT NULL,
    "negotiationId" UUID NOT NULL,
    "roundNumber" INTEGER NOT NULL,
    "roundDate" TIMESTAMP(3),
    "customerOffer" DECIMAL(14,4),
    "ourOffer" DECIMAL(14,4),
    "discountPct" DECIMAL(5,2),
    "concessionType" "NegotiationConcessionType",
    "concessionValue" DECIMAL(14,2),
    "considerationObtained" TEXT,
    "considerationValue" DECIMAL(14,2),
    "approvalId" UUID,
    "outcome" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NegotiationRound_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RedFlag" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "orgId" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "flagType" TEXT NOT NULL,
    "severity" "RedFlagSeverity" NOT NULL DEFAULT 'Medium',
    "description" TEXT,
    "blocksDealing" BOOLEAN NOT NULL DEFAULT false,
    "raisedBy" UUID NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RedFlag_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Communication_orgId_idx" ON "Communication"("orgId");

-- CreateIndex
CREATE INDEX "Communication_companyId_idx" ON "Communication"("companyId");

-- CreateIndex
CREATE INDEX "Communication_opportunityId_idx" ON "Communication"("opportunityId");

-- CreateIndex
CREATE INDEX "RFQAnalysis_orgId_idx" ON "RFQAnalysis"("orgId");

-- CreateIndex
CREATE INDEX "RFQAnalysis_opportunityId_idx" ON "RFQAnalysis"("opportunityId");

-- CreateIndex
CREATE INDEX "CustomerSample_orgId_idx" ON "CustomerSample"("orgId");

-- CreateIndex
CREATE INDEX "CustomerSample_opportunityId_idx" ON "CustomerSample"("opportunityId");

-- CreateIndex
CREATE INDEX "Negotiation_orgId_idx" ON "Negotiation"("orgId");

-- CreateIndex
CREATE INDEX "Negotiation_dealId_idx" ON "Negotiation"("dealId");

-- CreateIndex
CREATE INDEX "Negotiation_opportunityId_idx" ON "Negotiation"("opportunityId");

-- CreateIndex
CREATE INDEX "NegotiationRound_orgId_idx" ON "NegotiationRound"("orgId");

-- CreateIndex
CREATE INDEX "NegotiationRound_negotiationId_idx" ON "NegotiationRound"("negotiationId");

-- CreateIndex
CREATE INDEX "RedFlag_orgId_idx" ON "RedFlag"("orgId");

-- CreateIndex
CREATE INDEX "RedFlag_companyId_idx" ON "RedFlag"("companyId");

-- AddForeignKey
ALTER TABLE "Communication" ADD CONSTRAINT "Communication_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Communication" ADD CONSTRAINT "Communication_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Communication" ADD CONSTRAINT "Communication_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Communication" ADD CONSTRAINT "Communication_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RFQAnalysis" ADD CONSTRAINT "RFQAnalysis_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RFQAnalysis" ADD CONSTRAINT "RFQAnalysis_communicationId_fkey" FOREIGN KEY ("communicationId") REFERENCES "Communication"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RFQAnalysis" ADD CONSTRAINT "RFQAnalysis_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerSample" ADD CONSTRAINT "CustomerSample_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerSample" ADD CONSTRAINT "CustomerSample_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerSample" ADD CONSTRAINT "CustomerSample_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerSample" ADD CONSTRAINT "CustomerSample_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Negotiation" ADD CONSTRAINT "Negotiation_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Negotiation" ADD CONSTRAINT "Negotiation_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Negotiation" ADD CONSTRAINT "Negotiation_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NegotiationRound" ADD CONSTRAINT "NegotiationRound_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NegotiationRound" ADD CONSTRAINT "NegotiationRound_negotiationId_fkey" FOREIGN KEY ("negotiationId") REFERENCES "Negotiation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NegotiationRound" ADD CONSTRAINT "NegotiationRound_approvalId_fkey" FOREIGN KEY ("approvalId") REFERENCES "Approval"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RedFlag" ADD CONSTRAINT "RedFlag_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RedFlag" ADD CONSTRAINT "RedFlag_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RedFlag" ADD CONSTRAINT "RedFlag_raisedBy_fkey" FOREIGN KEY ("raisedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- RLS: عزل org لكل جدول جديد
ALTER TABLE "Communication" ENABLE ROW LEVEL SECURITY;
CREATE POLICY communication_org_isolation ON "Communication" FOR ALL USING ("orgId" = current_org_id()) WITH CHECK ("orgId" = current_org_id());

ALTER TABLE "RFQAnalysis" ENABLE ROW LEVEL SECURITY;
CREATE POLICY rfqanalysis_org_isolation ON "RFQAnalysis" FOR ALL USING ("orgId" = current_org_id()) WITH CHECK ("orgId" = current_org_id());

ALTER TABLE "CustomerSample" ENABLE ROW LEVEL SECURITY;
CREATE POLICY customersample_org_isolation ON "CustomerSample" FOR ALL USING ("orgId" = current_org_id()) WITH CHECK ("orgId" = current_org_id());

ALTER TABLE "Negotiation" ENABLE ROW LEVEL SECURITY;
CREATE POLICY negotiation_org_isolation ON "Negotiation" FOR ALL USING ("orgId" = current_org_id()) WITH CHECK ("orgId" = current_org_id());

ALTER TABLE "NegotiationRound" ENABLE ROW LEVEL SECURITY;
CREATE POLICY negotiationround_org_isolation ON "NegotiationRound" FOR ALL USING ("orgId" = current_org_id()) WITH CHECK ("orgId" = current_org_id());

ALTER TABLE "RedFlag" ENABLE ROW LEVEL SECURITY;
CREATE POLICY redflag_org_isolation ON "RedFlag" FOR ALL USING ("orgId" = current_org_id()) WITH CHECK ("orgId" = current_org_id());
