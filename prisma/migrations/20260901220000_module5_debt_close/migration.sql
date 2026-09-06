-- AlterTable
ALTER TABLE "Certificate" ADD COLUMN     "facilityId" UUID,
ADD COLUMN     "supplierId" UUID;

-- AlterTable
ALTER TABLE "ComplianceCase" ADD COLUMN     "supplierId" UUID;

-- AlterTable
ALTER TABLE "OriginProof" ADD COLUMN     "shipmentId" UUID;

-- AlterTable
ALTER TABLE "Registration" ADD COLUMN     "facilityId" UUID,
ADD COLUMN     "supplierId" UUID;

-- CreateIndex
CREATE INDEX "Certificate_supplierId_idx" ON "Certificate"("supplierId");

-- CreateIndex
CREATE INDEX "Certificate_facilityId_idx" ON "Certificate"("facilityId");

-- CreateIndex
CREATE INDEX "ComplianceCase_supplierId_idx" ON "ComplianceCase"("supplierId");

-- CreateIndex
CREATE INDEX "OriginProof_shipmentId_idx" ON "OriginProof"("shipmentId");

-- CreateIndex
CREATE INDEX "Registration_supplierId_idx" ON "Registration"("supplierId");

-- CreateIndex
CREATE INDEX "Registration_facilityId_idx" ON "Registration"("facilityId");

-- AddForeignKey
ALTER TABLE "ComplianceCase" ADD CONSTRAINT "ComplianceCase_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Registration" ADD CONSTRAINT "Registration_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Registration" ADD CONSTRAINT "Registration_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OriginProof" ADD CONSTRAINT "OriginProof_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

