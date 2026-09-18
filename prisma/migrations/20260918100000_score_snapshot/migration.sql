-- ScoreSnapshot (BACKLOG.md § P2/P3 — "لا تُعطِ درجة موزونة بلا تبرير"، ERD §3).
-- نفس تصميم AuditLog بالحرف: subjectType/subjectId نص/uuid بلا FK فعلي، جدول عابر لكيانات كتير
-- مختلفة عبر الوحدات التسع. أول استخدام فعلي هو ProductMarketAnalysis.opportunityScore/riskScore.
CREATE TYPE "ScoreType" AS ENUM ('ProductMarketOpportunity', 'ProductMarketRisk');

CREATE TABLE "ScoreSnapshot" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "orgId" UUID NOT NULL,
  "subjectType" TEXT NOT NULL,
  "subjectId" UUID NOT NULL,
  "scoreType" "ScoreType" NOT NULL,
  "totalScore" DECIMAL(5,2) NOT NULL,
  "componentsBreakdown" JSONB,
  "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "calculatedBy" UUID,
  CONSTRAINT "ScoreSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ScoreSnapshot_orgId_idx" ON "ScoreSnapshot"("orgId");
CREATE INDEX "ScoreSnapshot_subjectType_subjectId_idx" ON "ScoreSnapshot"("subjectType", "subjectId");

ALTER TABLE "ScoreSnapshot" ADD CONSTRAINT "ScoreSnapshot_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ScoreSnapshot" ADD CONSTRAINT "ScoreSnapshot_calculatedBy_fkey"
  FOREIGN KEY ("calculatedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ScoreSnapshot" ENABLE ROW LEVEL SECURITY;
CREATE POLICY scoresnapshot_org_isolation ON "ScoreSnapshot"
  FOR ALL USING ("orgId" = current_org_id()) WITH CHECK ("orgId" = current_org_id());
