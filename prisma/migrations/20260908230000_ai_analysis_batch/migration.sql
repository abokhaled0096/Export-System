-- تحليل شامل (كل منتج × كل سوق) دفعة واحدة — راجع src/app/analysis/batchActions.ts.
-- إضافية بالكامل (بلا DROP)، آمنة على بيانات موجودة: aiDetails فاضي لتحاليل موجودة سابقًا.

ALTER TABLE "ProductMarketAnalysis" ADD COLUMN "aiDetails" JSONB;

-- ⚠️ الاسم "AiBatchStatus" (مش "BatchStatus") عمدًا — فيه enum اسمه "BatchStatus" موجود بالفعل
-- لجدول "Batch" (دفعات الإنتاج، وحدة 7) — تصادم أسماء لو استخدمنا نفس الاسم (راجع schema.prisma).
CREATE TYPE "BatchAnalysisKind" AS ENUM ('MarketAnalysis', 'Competitors');
CREATE TYPE "AiBatchStatus" AS ENUM ('Pending', 'Running', 'Completed', 'Failed', 'Cancelled');
CREATE TYPE "BatchItemStatus" AS ENUM ('Pending', 'Running', 'Succeeded', 'Failed');

-- CreateTable
CREATE TABLE "AiAnalysisBatch" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "orgId" UUID NOT NULL,
    "kind" "BatchAnalysisKind" NOT NULL,
    "year" INTEGER NOT NULL,
    "status" "AiBatchStatus" NOT NULL DEFAULT 'Pending',
    "totalPairs" INTEGER NOT NULL,
    "succeededCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "createdBy" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "AiAnalysisBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiAnalysisBatchItem" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "orgId" UUID NOT NULL,
    "batchId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "marketId" UUID NOT NULL,
    "status" "BatchItemStatus" NOT NULL DEFAULT 'Pending',
    "resultId" UUID,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "AiAnalysisBatchItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiAnalysisBatch_orgId_idx" ON "AiAnalysisBatch"("orgId");

-- CreateIndex
CREATE INDEX "AiAnalysisBatchItem_orgId_idx" ON "AiAnalysisBatchItem"("orgId");

-- CreateIndex
CREATE INDEX "AiAnalysisBatchItem_batchId_status_idx" ON "AiAnalysisBatchItem"("batchId", "status");

-- AddForeignKey
ALTER TABLE "AiAnalysisBatchItem" ADD CONSTRAINT "AiAnalysisBatchItem_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "AiAnalysisBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ============ RLS: عزل org (نفس نمط Competitor بالحرف) ============
ALTER TABLE "AiAnalysisBatch" ENABLE ROW LEVEL SECURITY;
CREATE POLICY ai_analysis_batch_org_isolation ON "AiAnalysisBatch"
  FOR ALL USING ("orgId" = current_org_id()) WITH CHECK ("orgId" = current_org_id());

ALTER TABLE "AiAnalysisBatchItem" ENABLE ROW LEVEL SECURITY;
CREATE POLICY ai_analysis_batch_item_org_isolation ON "AiAnalysisBatchItem"
  FOR ALL USING ("orgId" = current_org_id()) WITH CHECK ("orgId" = current_org_id());
