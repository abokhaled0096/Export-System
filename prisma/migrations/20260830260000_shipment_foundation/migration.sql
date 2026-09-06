-- وحدة 6 — اللوجستيات (ELCTIS): الشريحة الأولى (30 أغسطس). الحلقة الأساسية بس:
-- Shipment/ShipmentParty/Booking/Container/Milestone (5 من 17 كيان، راجع docs/ERD.md §9).
-- Gate.requiresAciVerification حقل جديد (مش من الـERD الأصلي، نفس نمط requiresOriginProofVerification)
-- بيحدَّد وقت إنشاء بوابة الشحن/الإبحار — الـTrigger الرابع في migration الـRLS التالية.

-- CreateEnum
CREATE TYPE "ShipmentType" AS ENUM ('Commercial', 'Sample', 'Trial', 'Tender', 'Consolidated');

-- CreateEnum
CREATE TYPE "TransportMode" AS ENUM ('Sea', 'Air', 'Road', 'Rail', 'Multimodal', 'Courier');

-- CreateEnum
CREATE TYPE "LoadType" AS ENUM ('FCL', 'LCL');

-- CreateEnum
CREATE TYPE "ShipmentStatus" AS ENUM ('Draft', 'Planning', 'AwaitingRates', 'BookingRequested', 'BookingConfirmed', 'CargoPreparation', 'Loading', 'CustomsClearance', 'GateIn', 'Departed', 'InTransit', 'Transshipment', 'Arrived', 'CustomsHold', 'Clearance', 'OutForDelivery', 'Delivered', 'EmptyReturned', 'Closed', 'Cancelled', 'Exception');

-- CreateEnum
CREATE TYPE "AciStatus" AS ENUM ('NotRequired', 'Pending', 'Submitted', 'Approved', 'Rejected');

-- CreateEnum
CREATE TYPE "PartyRole" AS ENUM ('Buyer', 'Consignee', 'NotifyParty', 'ImporterOfRecord', 'CustomsBroker');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('Draft', 'Requested', 'Pending', 'Confirmed', 'Amended', 'Rolled', 'Split', 'Cancelled', 'Expired', 'Completed');

-- CreateEnum
CREATE TYPE "ContainerType" AS ENUM ('GP20', 'GP40', 'HC40', 'RF20', 'RF40', 'HCRF40', 'OpenTop', 'FlatRack', 'Tank');

-- CreateEnum
CREATE TYPE "MilestoneStatus" AS ENUM ('NotStarted', 'Planned', 'InProgress', 'Completed', 'Delayed', 'Missed', 'Blocked', 'NotApplicable');

-- AlterTable
ALTER TABLE "Gate" ADD COLUMN     "requiresAciVerification" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "Shipment" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "orgId" UUID NOT NULL,
    "dealId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "complianceCaseId" UUID,
    "shipmentType" "ShipmentType" NOT NULL,
    "transportMode" "TransportMode" NOT NULL,
    "loadType" "LoadType",
    "incoterm" "Incoterm" NOT NULL,
    "originPort" TEXT NOT NULL,
    "destinationPort" TEXT NOT NULL,
    "finalDestination" TEXT,
    "cargoReadyDate" TIMESTAMP(3),
    "etd" TIMESTAMP(3),
    "actualDeparture" TIMESTAMP(3),
    "eta" TIMESTAMP(3),
    "revisedEta" TIMESTAMP(3),
    "actualArrival" TIMESTAMP(3),
    "status" "ShipmentStatus" NOT NULL DEFAULT 'Draft',
    "acidNumber" TEXT,
    "aciStatus" "AciStatus" NOT NULL DEFAULT 'NotRequired',
    "aciSubmittedAt" TIMESTAMP(3),
    "aciDeadlineMet" BOOLEAN NOT NULL DEFAULT false,
    "cargoXRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Shipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShipmentParty" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "orgId" UUID NOT NULL,
    "shipmentId" UUID NOT NULL,
    "partyRole" "PartyRole" NOT NULL,
    "companyId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShipmentParty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Booking" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "orgId" UUID NOT NULL,
    "shipmentId" UUID NOT NULL,
    "bookingNumber" TEXT,
    "vessel" TEXT,
    "voyage" TEXT,
    "etd" TIMESTAMP(3),
    "eta" TIMESTAMP(3),
    "documentationCutoff" TIMESTAMP(3),
    "vgmDeadline" TIMESTAMP(3),
    "portClosingDate" TIMESTAMP(3),
    "freeTimeDays" INTEGER,
    "status" "BookingStatus" NOT NULL DEFAULT 'Draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Container" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "orgId" UUID NOT NULL,
    "shipmentId" UUID NOT NULL,
    "containerNumber" TEXT,
    "containerType" "ContainerType" NOT NULL,
    "sealNumber" TEXT,
    "maxPayload" DECIMAL(10,2),
    "netWeight" DECIMAL(10,2),
    "grossWeight" DECIMAL(10,2),
    "usedVolume" DECIMAL(10,3),
    "availableVolume" DECIMAL(10,3),
    "setPointTempC" DECIMAL(5,2),
    "vgmSubmittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Container_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Milestone" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "orgId" UUID NOT NULL,
    "shipmentId" UUID NOT NULL,
    "milestoneName" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "plannedDate" TIMESTAMP(3),
    "forecastDate" TIMESTAMP(3),
    "actualDate" TIMESTAMP(3),
    "status" "MilestoneStatus" NOT NULL DEFAULT 'NotStarted',
    "ownerId" UUID,
    "delayReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Milestone_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Shipment_orgId_idx" ON "Shipment"("orgId");

-- CreateIndex
CREATE INDEX "Shipment_dealId_idx" ON "Shipment"("dealId");

-- CreateIndex
CREATE INDEX "Shipment_complianceCaseId_idx" ON "Shipment"("complianceCaseId");

-- CreateIndex
CREATE INDEX "ShipmentParty_orgId_idx" ON "ShipmentParty"("orgId");

-- CreateIndex
CREATE INDEX "ShipmentParty_shipmentId_idx" ON "ShipmentParty"("shipmentId");

-- CreateIndex
CREATE INDEX "Booking_orgId_idx" ON "Booking"("orgId");

-- CreateIndex
CREATE INDEX "Booking_shipmentId_idx" ON "Booking"("shipmentId");

-- CreateIndex
CREATE INDEX "Container_orgId_idx" ON "Container"("orgId");

-- CreateIndex
CREATE INDEX "Container_shipmentId_idx" ON "Container"("shipmentId");

-- CreateIndex
CREATE INDEX "Milestone_orgId_idx" ON "Milestone"("orgId");

-- CreateIndex
CREATE INDEX "Milestone_shipmentId_idx" ON "Milestone"("shipmentId");

-- AddForeignKey
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_complianceCaseId_fkey" FOREIGN KEY ("complianceCaseId") REFERENCES "ComplianceCase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipmentParty" ADD CONSTRAINT "ShipmentParty_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipmentParty" ADD CONSTRAINT "ShipmentParty_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipmentParty" ADD CONSTRAINT "ShipmentParty_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Container" ADD CONSTRAINT "Container_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Container" ADD CONSTRAINT "Container_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Milestone" ADD CONSTRAINT "Milestone_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Milestone" ADD CONSTRAINT "Milestone_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Milestone" ADD CONSTRAINT "Milestone_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
