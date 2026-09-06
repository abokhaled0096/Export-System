-- وحدة 6 — اللوجستيات (ELCTIS): الشريحة الثالثة (30 أغسطس). TemperatureLog/TransportTrip/Claim
-- (3 من الـ8 كيان المتبقي، راجع docs/ERD.md §9 وdocs/SCOPE-P6.md). بلا Trigger — مفيش قيد عمل
-- حرج مذكور بيتعلق بيهم. TransportTrip.driverPhone عمود BYTEA (Bytes? في Prisma) مشفّر عموديًا
-- من هنا فصاعدًا (بيانات شخصية 🔒)، بلا واجهة إدخال في هذه الشريحة — نفس نمط Company.bankAccountName.

-- CreateEnum
CREATE TYPE "TransportTripStatus" AS ENUM ('Scheduled', 'InProgress', 'Completed', 'Delayed', 'Cancelled');

-- CreateEnum
CREATE TYPE "ClaimType" AS ENUM ('CargoDamage', 'TemperatureDamage', 'WetDamage', 'Shortage', 'Loss', 'Delay', 'ContainerDamage', 'Overcharge', 'InvoiceDispute', 'DemurrageDispute', 'ServiceFailure');

-- CreateEnum
CREATE TYPE "ClaimStatus" AS ENUM ('Draft', 'EvidenceCollection', 'Submitted', 'UnderReview', 'AdditionalInfoRequired', 'Accepted', 'PartiallyAccepted', 'Rejected', 'Settled', 'Closed');

-- CreateTable
CREATE TABLE "TemperatureLog" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "orgId" UUID NOT NULL,
    "shipmentId" UUID NOT NULL,
    "containerId" UUID,
    "recordedAt" TIMESTAMP(3) NOT NULL,
    "temperatureC" DECIMAL(5,2) NOT NULL,
    "humidityPct" DECIMAL(5,2),
    "source" TEXT,
    "deviceId" TEXT,
    "isExcursion" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TemperatureLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransportTrip" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "orgId" UUID NOT NULL,
    "shipmentId" UUID NOT NULL,
    "carrier" TEXT,
    "vehicleNumber" TEXT,
    "driverName" TEXT,
    "driverPhone" BYTEA,
    "pickupLocation" TEXT,
    "appointmentAt" TIMESTAMP(3),
    "loadingStart" TIMESTAMP(3),
    "loadingFinish" TIMESTAMP(3),
    "gateInAt" TIMESTAMP(3),
    "emptyReturnAt" TIMESTAMP(3),
    "cost" DECIMAL(14,2),
    "currency" TEXT,
    "status" "TransportTripStatus" NOT NULL DEFAULT 'Scheduled',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransportTrip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Claim" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "orgId" UUID NOT NULL,
    "shipmentId" UUID NOT NULL,
    "claimType" "ClaimType" NOT NULL,
    "claimedAgainst" TEXT,
    "incidentDate" TIMESTAMP(3),
    "notificationDate" TIMESTAMP(3),
    "claimDeadline" TIMESTAMP(3),
    "claimedAmount" DECIMAL(14,2),
    "currency" TEXT,
    "settlementAmount" DECIMAL(14,2),
    "status" "ClaimStatus" NOT NULL DEFAULT 'Draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Claim_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TemperatureLog_orgId_idx" ON "TemperatureLog"("orgId");

-- CreateIndex
CREATE INDEX "TemperatureLog_shipmentId_idx" ON "TemperatureLog"("shipmentId");

-- CreateIndex
CREATE INDEX "TransportTrip_orgId_idx" ON "TransportTrip"("orgId");

-- CreateIndex
CREATE INDEX "TransportTrip_shipmentId_idx" ON "TransportTrip"("shipmentId");

-- CreateIndex
CREATE INDEX "Claim_orgId_idx" ON "Claim"("orgId");

-- CreateIndex
CREATE INDEX "Claim_shipmentId_idx" ON "Claim"("shipmentId");

-- AddForeignKey
ALTER TABLE "TemperatureLog" ADD CONSTRAINT "TemperatureLog_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemperatureLog" ADD CONSTRAINT "TemperatureLog_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemperatureLog" ADD CONSTRAINT "TemperatureLog_containerId_fkey" FOREIGN KEY ("containerId") REFERENCES "Container"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransportTrip" ADD CONSTRAINT "TransportTrip_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransportTrip" ADD CONSTRAINT "TransportTrip_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
