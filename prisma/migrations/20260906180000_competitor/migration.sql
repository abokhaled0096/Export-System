-- CreateTable
CREATE TABLE "Competitor" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "orgId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "marketId" UUID NOT NULL,
    "countryName" TEXT NOT NULL,
    "strengthMonths" INTEGER[],
    "weaknessMonths" INTEGER[],
    "priceRangeMin" DECIMAL(14,4),
    "priceRangeMax" DECIMAL(14,4),
    "currency" CHAR(3) NOT NULL,
    "source" "AnalysisSource" NOT NULL DEFAULT 'Manual',
    "aiReasoning" TEXT,
    "aiSources" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Competitor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Competitor_orgId_idx" ON "Competitor"("orgId");

-- CreateIndex
CREATE INDEX "Competitor_productId_marketId_idx" ON "Competitor"("productId", "marketId");

-- AddForeignKey
ALTER TABLE "Competitor" ADD CONSTRAINT "Competitor_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Competitor" ADD CONSTRAINT "Competitor_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ============ RLS: عزل org (نفس نمط ProductMarketAnalysis بالحرف) ============
ALTER TABLE "Competitor" ENABLE ROW LEVEL SECURITY;
CREATE POLICY competitor_org_isolation ON "Competitor"
  FOR ALL USING ("orgId" = current_org_id()) WITH CHECK ("orgId" = current_org_id());
