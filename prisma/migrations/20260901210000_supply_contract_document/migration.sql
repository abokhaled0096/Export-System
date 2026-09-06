-- AlterTable
ALTER TABLE "SupplyContract" ADD COLUMN     "documentId" UUID;

-- CreateIndex
CREATE INDEX "SupplyContract_documentId_idx" ON "SupplyContract"("documentId");

-- AddForeignKey
ALTER TABLE "SupplyContract" ADD CONSTRAINT "SupplyContract_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

