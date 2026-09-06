-- CreateEnum
CREATE TYPE "RiskStatus" AS ENUM ('Open', 'Mitigated', 'Closed');

-- CreateEnum
CREATE TYPE "MasterDataChangeStatus" AS ENUM ('Pending', 'Approved', 'Rejected');

-- CreateTable
CREATE TABLE "SegregationOfDutyRule" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "orgId" UUID NOT NULL,
    "action1" TEXT NOT NULL,
    "action2" TEXT NOT NULL,
    "mustBeDifferentUser" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SegregationOfDutyRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DecisionLogEntry" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "orgId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "decisionDate" TIMESTAMP(3) NOT NULL,
    "decidedBy" UUID NOT NULL,
    "context" TEXT,
    "outcome" TEXT,
    "relatedEntityType" TEXT,
    "relatedEntityId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DecisionLogEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiskRegisterItem" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "orgId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "probability" INTEGER NOT NULL,
    "financialImpact" DECIMAL(14,2) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "ownerId" UUID NOT NULL,
    "mitigation" TEXT,
    "status" "RiskStatus" NOT NULL DEFAULT 'Open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RiskRegisterItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KPI" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "orgId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "ownerId" UUID NOT NULL,
    "targetValue" DECIMAL(14,2) NOT NULL,
    "actualValue" DECIMAL(14,2),
    "periodId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KPI_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "orgId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "notificationType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "relatedEntityType" TEXT,
    "relatedEntityId" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MasterDataChangeRequest" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "orgId" UUID NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "proposedChanges" JSONB NOT NULL,
    "requestedBy" UUID NOT NULL,
    "status" "MasterDataChangeStatus" NOT NULL DEFAULT 'Pending',
    "approvedBy" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MasterDataChangeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SegregationOfDutyRule_orgId_idx" ON "SegregationOfDutyRule"("orgId");

-- CreateIndex
CREATE INDEX "DecisionLogEntry_orgId_idx" ON "DecisionLogEntry"("orgId");

-- CreateIndex
CREATE INDEX "RiskRegisterItem_orgId_idx" ON "RiskRegisterItem"("orgId");

-- CreateIndex
CREATE INDEX "KPI_orgId_idx" ON "KPI"("orgId");

-- CreateIndex
CREATE INDEX "KPI_periodId_idx" ON "KPI"("periodId");

-- CreateIndex
CREATE INDEX "Notification_orgId_idx" ON "Notification"("orgId");

-- CreateIndex
CREATE INDEX "Notification_userId_idx" ON "Notification"("userId");

-- CreateIndex
CREATE INDEX "MasterDataChangeRequest_orgId_idx" ON "MasterDataChangeRequest"("orgId");

-- AddForeignKey
ALTER TABLE "SegregationOfDutyRule" ADD CONSTRAINT "SegregationOfDutyRule_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DecisionLogEntry" ADD CONSTRAINT "DecisionLogEntry_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DecisionLogEntry" ADD CONSTRAINT "DecisionLogEntry_decidedBy_fkey" FOREIGN KEY ("decidedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskRegisterItem" ADD CONSTRAINT "RiskRegisterItem_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskRegisterItem" ADD CONSTRAINT "RiskRegisterItem_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KPI" ADD CONSTRAINT "KPI_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KPI" ADD CONSTRAINT "KPI_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KPI" ADD CONSTRAINT "KPI_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "AccountingPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MasterDataChangeRequest" ADD CONSTRAINT "MasterDataChangeRequest_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MasterDataChangeRequest" ADD CONSTRAINT "MasterDataChangeRequest_requestedBy_fkey" FOREIGN KEY ("requestedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MasterDataChangeRequest" ADD CONSTRAINT "MasterDataChangeRequest_approvedBy_fkey" FOREIGN KEY ("approvedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;



-- ============ RLS: عزل org لكل جدول جديد ============
ALTER TABLE "SegregationOfDutyRule" ENABLE ROW LEVEL SECURITY;
CREATE POLICY segregationofdutyrule_org_isolation ON "SegregationOfDutyRule" FOR ALL USING ("orgId" = current_org_id()) WITH CHECK ("orgId" = current_org_id());

ALTER TABLE "DecisionLogEntry" ENABLE ROW LEVEL SECURITY;
CREATE POLICY decisionlogentry_org_isolation ON "DecisionLogEntry" FOR ALL USING ("orgId" = current_org_id()) WITH CHECK ("orgId" = current_org_id());

ALTER TABLE "RiskRegisterItem" ENABLE ROW LEVEL SECURITY;
CREATE POLICY riskregisteritem_org_isolation ON "RiskRegisterItem" FOR ALL USING ("orgId" = current_org_id()) WITH CHECK ("orgId" = current_org_id());

ALTER TABLE "KPI" ENABLE ROW LEVEL SECURITY;
CREATE POLICY kpi_org_isolation ON "KPI" FOR ALL USING ("orgId" = current_org_id()) WITH CHECK ("orgId" = current_org_id());

ALTER TABLE "Notification" ENABLE ROW LEVEL SECURITY;
CREATE POLICY notification_org_isolation ON "Notification" FOR ALL USING ("orgId" = current_org_id()) WITH CHECK ("orgId" = current_org_id());

ALTER TABLE "MasterDataChangeRequest" ENABLE ROW LEVEL SECURITY;
CREATE POLICY masterdatachangerequest_org_isolation ON "MasterDataChangeRequest" FOR ALL USING ("orgId" = current_org_id()) WITH CHECK ("orgId" = current_org_id());


-- ============ إنفاذ فصل المهام على الدفعات ============
-- docs/ERD.md §12: "⚠️ إنفاذ إلزامي (v4): SegregationOfDutyRule وWorkflowDefinition لازم
-- يتفعّلوا كـTriggers/RLS Policies حقيقية على الجداول المتأثرة، مش تحقق واجهة". المثال الحرفي
-- في الـERD (Supplier→Payment عابر الكيانات) مش قابل للتنفيذ دلوقتي لأن Supplier مالوش
-- createdBy — مسجَّل في BACKLOG.md. الإنفاذ هنا على Payment.createdBy/approvedBy نفسها، وهو
-- الدَين اللي كان مسجَّل بالفعل في BACKLOG.md من شريحة AR/AP.
--
-- ⚠️ القاعدة مش مفروضة افتراضيًا — بتتفعّل بس لو فيه صف SegregationOfDutyRule فعّال يطابق
-- الزوج ده، نفس تصميم الـERD نفسه (جدول قواعد قابل للتخصيص من الواجهة، مش قيد مكتوب في الكود).
CREATE OR REPLACE FUNCTION public.enforce_segregation_of_duty_payment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_rule_active BOOLEAN;
BEGIN
  IF NEW."approvedBy" IS NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD."approvedBy" IS NOT DISTINCT FROM NEW."approvedBy" THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM "SegregationOfDutyRule"
     WHERE "orgId" = NEW."orgId"
       AND "action1" = 'Payment.Create'
       AND "action2" = 'Payment.Approve'
       AND "mustBeDifferentUser" = true
       AND "isActive" = true
  ) INTO v_rule_active;

  IF v_rule_active AND NEW."approvedBy" = NEW."createdBy" THEN
    RAISE EXCEPTION 'فصل المهام مفعّل — منشئ الدفعة % لازم يكون شخص مختلف عن معتمِدها', NEW."paymentNumber"
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.enforce_segregation_of_duty_payment() FROM PUBLIC;

CREATE TRIGGER payment_segregation_of_duty_check
  BEFORE INSERT OR UPDATE ON "Payment"
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_segregation_of_duty_payment();
