-- وحدة 6 — اللوجستيات (ELCTIS): الشريحة الرابعة والأخيرة (تسعير الشحن، 30 أغسطس).
-- ServiceProvider/Route/FreightQuote/FreightQuoteLine — كيانات بيانات أساسية مستقلة، بلا Trigger.
-- استرجاع Booking.providerId/freightQuoteId اللي اتشالوا في الشريحة الأولى. بعد الشريحة دي وحدة 6
-- بتبقى 16/17 — ShipmentLot الاستثناء الوحيد المتبقي (محتاج Lot من وحدة 7).

-- CreateEnum
CREATE TYPE "ServiceProviderType" AS ENUM ('ShippingLine', 'FreightForwarder', 'TruckingCompany', 'CustomsBroker', 'PortAgent', 'Warehouse', 'Surveyor', 'InsuranceCompany', 'Courier', 'ColdStorage', 'ContainerDepot');

-- CreateEnum
CREATE TYPE "ServiceProviderStatus" AS ENUM ('Preferred', 'Approved', 'Conditional', 'UnderReview', 'Suspended', 'Blacklisted');

-- CreateEnum
CREATE TYPE "RouteClassification" AS ENUM ('Preferred', 'Approved', 'Conditional', 'HighRisk', 'Avoid', 'UnderReview');

-- CreateEnum
CREATE TYPE "FreightQuoteStatus" AS ENUM ('Draft', 'Approved', 'Expired');

-- CreateEnum
CREATE TYPE "FreightQuoteLineCategory" AS ENUM ('Origin', 'Freight', 'Destination', 'Insurance', 'Other');

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "freightQuoteId" UUID,
ADD COLUMN     "providerId" UUID;

-- CreateTable
CREATE TABLE "ServiceProvider" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "orgId" UUID NOT NULL,
    "providerType" "ServiceProviderType" NOT NULL,
    "name" TEXT NOT NULL,
    "country" TEXT,
    "onTimePerformance" DECIMAL(5,2),
    "invoiceAccuracy" DECIMAL(5,2),
    "status" "ServiceProviderStatus" NOT NULL DEFAULT 'UnderReview',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceProvider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Route" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "orgId" UUID NOT NULL,
    "originPort" TEXT NOT NULL,
    "destinationPort" TEXT NOT NULL,
    "transportModes" TEXT[],
    "transitPorts" TEXT[],
    "transshipmentCount" INTEGER,
    "typicalTransitDays" INTEGER,
    "worstTransitDays" INTEGER,
    "weeklySailings" INTEGER,
    "classification" "RouteClassification" NOT NULL DEFAULT 'UnderReview',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Route_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FreightQuote" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "orgId" UUID NOT NULL,
    "routeId" UUID NOT NULL,
    "providerId" UUID NOT NULL,
    "containerType" "ContainerType",
    "originCharges" DECIMAL(14,2),
    "mainFreight" DECIMAL(14,2),
    "destinationCharges" DECIMAL(14,2),
    "insurance" DECIMAL(14,2),
    "currency" TEXT,
    "fxRateId" UUID,
    "transitDays" INTEGER,
    "freeTimeDays" INTEGER,
    "validFrom" TIMESTAMP(3),
    "validUntil" TIMESTAMP(3),
    "status" "FreightQuoteStatus" NOT NULL DEFAULT 'Draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FreightQuote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FreightQuoteLine" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "orgId" UUID NOT NULL,
    "freightQuoteId" UUID NOT NULL,
    "chargeCode" TEXT NOT NULL,
    "category" "FreightQuoteLineCategory" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FreightQuoteLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ServiceProvider_orgId_idx" ON "ServiceProvider"("orgId");

-- CreateIndex
CREATE INDEX "Route_orgId_idx" ON "Route"("orgId");

-- CreateIndex
CREATE INDEX "FreightQuote_orgId_idx" ON "FreightQuote"("orgId");

-- CreateIndex
CREATE INDEX "FreightQuote_routeId_idx" ON "FreightQuote"("routeId");

-- CreateIndex
CREATE INDEX "FreightQuote_providerId_idx" ON "FreightQuote"("providerId");

-- CreateIndex
CREATE INDEX "FreightQuoteLine_orgId_idx" ON "FreightQuoteLine"("orgId");

-- CreateIndex
CREATE INDEX "FreightQuoteLine_freightQuoteId_idx" ON "FreightQuoteLine"("freightQuoteId");

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "ServiceProvider"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_freightQuoteId_fkey" FOREIGN KEY ("freightQuoteId") REFERENCES "FreightQuote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceProvider" ADD CONSTRAINT "ServiceProvider_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Route" ADD CONSTRAINT "Route_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FreightQuote" ADD CONSTRAINT "FreightQuote_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FreightQuote" ADD CONSTRAINT "FreightQuote_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "Route"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FreightQuote" ADD CONSTRAINT "FreightQuote_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "ServiceProvider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FreightQuote" ADD CONSTRAINT "FreightQuote_fxRateId_fkey" FOREIGN KEY ("fxRateId") REFERENCES "ExchangeRate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FreightQuoteLine" ADD CONSTRAINT "FreightQuoteLine_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FreightQuoteLine" ADD CONSTRAINT "FreightQuoteLine_freightQuoteId_fkey" FOREIGN KEY ("freightQuoteId") REFERENCES "FreightQuote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
