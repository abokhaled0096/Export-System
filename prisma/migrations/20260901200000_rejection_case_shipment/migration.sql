
-- AlterTable
ALTER TABLE "RejectionCase" ADD COLUMN     "shipmentId" UUID;

-- CreateIndex
CREATE INDEX "RejectionCase_shipmentId_idx" ON "RejectionCase"("shipmentId");

-- AddForeignKey
ALTER TABLE "RejectionCase" ADD CONSTRAINT "RejectionCase_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

