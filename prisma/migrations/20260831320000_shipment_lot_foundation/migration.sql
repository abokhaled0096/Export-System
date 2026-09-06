
-- CreateTable
CREATE TABLE "ShipmentLot" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "orgId" UUID NOT NULL,
    "shipmentId" UUID NOT NULL,
    "lotId" UUID NOT NULL,
    "quantity" DECIMAL(14,3),
    "cartons" INTEGER,
    "netWeight" DECIMAL(12,3),
    "grossWeight" DECIMAL(12,3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShipmentLot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ShipmentLot_orgId_idx" ON "ShipmentLot"("orgId");

-- CreateIndex
CREATE INDEX "ShipmentLot_shipmentId_idx" ON "ShipmentLot"("shipmentId");

-- CreateIndex
CREATE INDEX "ShipmentLot_lotId_idx" ON "ShipmentLot"("lotId");

-- AddForeignKey
ALTER TABLE "ShipmentLot" ADD CONSTRAINT "ShipmentLot_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipmentLot" ADD CONSTRAINT "ShipmentLot_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipmentLot" ADD CONSTRAINT "ShipmentLot_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "Lot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

