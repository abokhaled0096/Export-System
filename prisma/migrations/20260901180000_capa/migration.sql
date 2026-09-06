
-- CreateEnum
CREATE TYPE "CAPARootCauseMethod" AS ENUM ('FiveWhys', 'Fishbone', 'Other');

-- CreateEnum
CREATE TYPE "CAPAStatus" AS ENUM ('Open', 'InProgress', 'VerificationPending', 'Effective', 'Ineffective', 'Closed', 'Overdue');

-- AlterTable
ALTER TABLE "NCR" ADD COLUMN     "capaId" UUID;

-- AlterTable
ALTER TABLE "RejectionCase" ADD COLUMN     "capaId" UUID;

-- CreateTable
CREATE TABLE "CAPA" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "orgId" UUID NOT NULL,
    "rootCause" TEXT,
    "rootCauseMethod" "CAPARootCauseMethod",
    "correctiveAction" TEXT,
    "preventiveAction" TEXT,
    "ownerId" UUID NOT NULL,
    "dueDate" TIMESTAMP(3),
    "verifiedBy" UUID,
    "status" "CAPAStatus" NOT NULL DEFAULT 'Open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CAPA_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CAPA_orgId_idx" ON "CAPA"("orgId");

-- CreateIndex
CREATE INDEX "NCR_capaId_idx" ON "NCR"("capaId");

-- CreateIndex
CREATE INDEX "RejectionCase_capaId_idx" ON "RejectionCase"("capaId");

-- AddForeignKey
ALTER TABLE "RejectionCase" ADD CONSTRAINT "RejectionCase_capaId_fkey" FOREIGN KEY ("capaId") REFERENCES "CAPA"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NCR" ADD CONSTRAINT "NCR_capaId_fkey" FOREIGN KEY ("capaId") REFERENCES "CAPA"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CAPA" ADD CONSTRAINT "CAPA_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CAPA" ADD CONSTRAINT "CAPA_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CAPA" ADD CONSTRAINT "CAPA_verifiedBy_fkey" FOREIGN KEY ("verifiedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============ RLS: عزل orgId على CAPA (بلا Trigger — مفيش قيد عمل حرج صريح في الـERD) ============
ALTER TABLE "CAPA" ENABLE ROW LEVEL SECURITY;
CREATE POLICY capa_org_isolation ON "CAPA"
  FOR ALL USING ("orgId" = current_org_id()) WITH CHECK ("orgId" = current_org_id());

