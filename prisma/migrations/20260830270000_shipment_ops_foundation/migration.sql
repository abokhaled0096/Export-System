-- وحدة 6 — اللوجستيات (ELCTIS): الشريحة الثانية (30 أغسطس) — التتبع التشغيلي.
-- ShipmentEvent/LogisticsException/FreeTimeRecord/ActualLogisticsCost (4 من الـ12 كيان المتبقي،
-- راجع docs/ERD.md §9 وdocs/SCOPE-P6.md). بلا Trigger — مفيش قيد عمل حرج مذكور بيتعلق بيهم.

-- CreateEnum
CREATE TYPE "ShipmentEventSource" AS ENUM ('Manual', 'ShippingLineWebsite', 'FreightForwarder', 'Port', 'CustomsBroker', 'Customer', 'ImportedCSV', 'API');

-- CreateEnum
CREATE TYPE "LogisticsExceptionType" AS ENUM ('BookingRejected', 'ContainerShortage', 'TruckDelay', 'LoadingDelay', 'CustomsHold', 'DocumentationError', 'VGMError', 'SealMismatch', 'Overweight', 'GateInMissed', 'VesselDelay', 'VesselChange', 'RollOver', 'PortCongestion', 'TransshipmentDelay', 'CargoDamage', 'TemperatureExcursion', 'ReeferFailure', 'Shortage', 'Demurrage', 'Detention', 'Strike', 'Weather', 'PortClosure');

-- CreateEnum
CREATE TYPE "LogisticsExceptionSeverity" AS ENUM ('Informational', 'Low', 'Medium', 'High', 'Critical');

-- CreateEnum
CREATE TYPE "LogisticsExceptionStatus" AS ENUM ('Open', 'InProgress', 'Resolved', 'Closed');

-- CreateEnum
CREATE TYPE "FreeTimeChargeType" AS ENUM ('Demurrage', 'Detention');

-- CreateEnum
CREATE TYPE "FreeTimeLocation" AS ENUM ('Origin', 'Destination');

-- CreateTable
CREATE TABLE "ShipmentEvent" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "orgId" UUID NOT NULL,
    "shipmentId" UUID NOT NULL,
    "eventType" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "location" TEXT,
    "source" "ShipmentEventSource" NOT NULL DEFAULT 'Manual',
    "reliability" INTEGER,
    "enteredBy" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShipmentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LogisticsException" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "orgId" UUID NOT NULL,
    "shipmentId" UUID NOT NULL,
    "exceptionType" "LogisticsExceptionType" NOT NULL,
    "severity" "LogisticsExceptionSeverity" NOT NULL,
    "detectedAt" TIMESTAMP(3) NOT NULL,
    "rootCause" TEXT,
    "financialExposure" DECIMAL(14,2),
    "scheduleImpactDays" INTEGER,
    "recoveryPlan" TEXT,
    "status" "LogisticsExceptionStatus" NOT NULL DEFAULT 'Open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LogisticsException_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FreeTimeRecord" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "orgId" UUID NOT NULL,
    "shipmentId" UUID NOT NULL,
    "containerId" UUID,
    "chargeType" "FreeTimeChargeType" NOT NULL,
    "location" "FreeTimeLocation" NOT NULL,
    "freeDays" INTEGER,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "tierRates" JSONB,
    "estimatedCost" DECIMAL(14,2),
    "actualCost" DECIMAL(14,2),
    "currency" TEXT,
    "responsibleParty" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FreeTimeRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActualLogisticsCost" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "orgId" UUID NOT NULL,
    "shipmentId" UUID NOT NULL,
    "costType" TEXT NOT NULL,
    "expectedAmount" DECIMAL(14,2),
    "actualAmount" DECIMAL(14,2),
    "currency" TEXT,
    "fxRateId" UUID,
    "invoiceReference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActualLogisticsCost_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ShipmentEvent_orgId_idx" ON "ShipmentEvent"("orgId");

-- CreateIndex
CREATE INDEX "ShipmentEvent_shipmentId_idx" ON "ShipmentEvent"("shipmentId");

-- CreateIndex
CREATE INDEX "LogisticsException_orgId_idx" ON "LogisticsException"("orgId");

-- CreateIndex
CREATE INDEX "LogisticsException_shipmentId_idx" ON "LogisticsException"("shipmentId");

-- CreateIndex
CREATE INDEX "FreeTimeRecord_orgId_idx" ON "FreeTimeRecord"("orgId");

-- CreateIndex
CREATE INDEX "FreeTimeRecord_shipmentId_idx" ON "FreeTimeRecord"("shipmentId");

-- CreateIndex
CREATE INDEX "ActualLogisticsCost_orgId_idx" ON "ActualLogisticsCost"("orgId");

-- CreateIndex
CREATE INDEX "ActualLogisticsCost_shipmentId_idx" ON "ActualLogisticsCost"("shipmentId");

-- AddForeignKey
ALTER TABLE "ShipmentEvent" ADD CONSTRAINT "ShipmentEvent_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipmentEvent" ADD CONSTRAINT "ShipmentEvent_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipmentEvent" ADD CONSTRAINT "ShipmentEvent_enteredBy_fkey" FOREIGN KEY ("enteredBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LogisticsException" ADD CONSTRAINT "LogisticsException_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LogisticsException" ADD CONSTRAINT "LogisticsException_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FreeTimeRecord" ADD CONSTRAINT "FreeTimeRecord_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FreeTimeRecord" ADD CONSTRAINT "FreeTimeRecord_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FreeTimeRecord" ADD CONSTRAINT "FreeTimeRecord_containerId_fkey" FOREIGN KEY ("containerId") REFERENCES "Container"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActualLogisticsCost" ADD CONSTRAINT "ActualLogisticsCost_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActualLogisticsCost" ADD CONSTRAINT "ActualLogisticsCost_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActualLogisticsCost" ADD CONSTRAINT "ActualLogisticsCost_fxRateId_fkey" FOREIGN KEY ("fxRateId") REFERENCES "ExchangeRate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
