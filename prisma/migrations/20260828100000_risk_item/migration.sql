-- RiskItem — شريحة ثالثة من P2 (ERD §5) — بنود مخاطر لكل سيناريو تسعير.

CREATE TYPE "RiskType" AS ENUM ('FX', 'Freight', 'Supplier', 'Quality', 'Credit', 'Compliance', 'Weather', 'Political');

CREATE TABLE "RiskItem" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "orgId" UUID NOT NULL,
    "scenarioId" UUID NOT NULL,
    "riskType" "RiskType" NOT NULL,
    "probability" DECIMAL(3,2) NOT NULL,
    "financialImpact" DECIMAL(14,2) NOT NULL,
    "expectedCost" DECIMAL(14,2) NOT NULL,
    "mitigation" TEXT,
    "residualRisk" DECIMAL(14,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RiskItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RiskItem_orgId_idx" ON "RiskItem"("orgId");
CREATE INDEX "RiskItem_scenarioId_idx" ON "RiskItem"("scenarioId");

ALTER TABLE "RiskItem" ADD CONSTRAINT "RiskItem_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "DealScenario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
