-- CreateTable
CREATE TABLE "ErrorLog" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "orgId" UUID,
    "userId" UUID,
    "action" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "stack" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ErrorLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ErrorLog_orgId_idx" ON "ErrorLog"("orgId");

-- CreateIndex
CREATE INDEX "ErrorLog_occurredAt_idx" ON "ErrorLog"("occurredAt");

-- AddForeignKey
ALTER TABLE "ErrorLog" ADD CONSTRAINT "ErrorLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============ ErrorLog: Insert-only فعليًا (نفس نمط AuditLog) ============
-- الكتابة بتتم عبر src/lib/errorLog.ts بـraw prisma (سياق خدمة، بيتخطى RLS بنيويًا لازم
-- ينجح حتى لو مفيش جلسة/orgId صالح وقت الخطأ). الـPolicy هنا دفاع إضافي لو أي مسار تاني
-- حاول يقرأ/يكتب عبر الدور authenticated مباشرة.
ALTER TABLE "ErrorLog" ENABLE ROW LEVEL SECURITY;
CREATE POLICY errorlog_select ON "ErrorLog"
  FOR SELECT USING ("orgId" = current_org_id());
CREATE POLICY errorlog_insert ON "ErrorLog"
  FOR INSERT WITH CHECK ("orgId" = current_org_id());
REVOKE UPDATE, DELETE ON "ErrorLog" FROM authenticated, anon;

