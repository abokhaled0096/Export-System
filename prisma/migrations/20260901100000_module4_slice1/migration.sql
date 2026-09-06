
-- CreateEnum
CREATE TYPE "ProductSpecificationStatus" AS ENUM ('Draft', 'InternalReview', 'CustomerReview', 'CustomerApproved', 'QualityApproved', 'Superseded', 'Expired');

-- AlterTable
ALTER TABLE "PurchaseOrder" ADD COLUMN     "specificationId" UUID;

-- CreateTable
CREATE TABLE "ProductSpecification" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "orgId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "ProductSpecificationStatus" NOT NULL DEFAULT 'Draft',
    "physicalParams" JSONB,
    "chemicalParams" JSONB,
    "microbiologicalParams" JSONB,
    "packagingSpec" JSONB,
    "labelSpec" JSONB,
    "storageConditions" TEXT,
    "shelfLifeDays" INTEGER,
    "approvedBy" UUID,
    "reviewDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductSpecification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductSpecification_orgId_idx" ON "ProductSpecification"("orgId");

-- CreateIndex
CREATE INDEX "ProductSpecification_productId_idx" ON "ProductSpecification"("productId");

-- CreateIndex
CREATE INDEX "PurchaseOrder_specificationId_idx" ON "PurchaseOrder"("specificationId");

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_specificationId_fkey" FOREIGN KEY ("specificationId") REFERENCES "ProductSpecification"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductSpecification" ADD CONSTRAINT "ProductSpecification_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductSpecification" ADD CONSTRAINT "ProductSpecification_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductSpecification" ADD CONSTRAINT "ProductSpecification_approvedBy_fkey" FOREIGN KEY ("approvedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============ RLS: عزل orgId على ProductSpecification (بلا Trigger — مفيش قيد عمل حرج صريح في الـERD) ============
ALTER TABLE "ProductSpecification" ENABLE ROW LEVEL SECURITY;
CREATE POLICY product_specification_org_isolation ON "ProductSpecification"
  FOR ALL USING ("orgId" = current_org_id()) WITH CHECK ("orgId" = current_org_id());

