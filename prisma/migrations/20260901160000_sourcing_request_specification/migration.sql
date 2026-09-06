
-- AlterTable
ALTER TABLE "SourcingRequest" ADD COLUMN     "specificationId" UUID;

-- CreateIndex
CREATE INDEX "SourcingRequest_specificationId_idx" ON "SourcingRequest"("specificationId");

-- AddForeignKey
ALTER TABLE "SourcingRequest" ADD CONSTRAINT "SourcingRequest_specificationId_fkey" FOREIGN KEY ("specificationId") REFERENCES "ProductSpecification"("id") ON DELETE SET NULL ON UPDATE CASCADE;

