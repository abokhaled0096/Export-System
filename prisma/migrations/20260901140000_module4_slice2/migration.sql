
-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('Quotation', 'ProformaInvoice', 'CommercialInvoice', 'PackingList', 'SalesContract', 'SalesConfirmation', 'TechnicalDataSheet', 'COA', 'Declaration', 'PriceList', 'EmailDraft');

-- CreateEnum
CREATE TYPE "DocumentLanguage" AS ENUM ('Arabic', 'English', 'Bilingual');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('Draft', 'Incomplete', 'UnderReview', 'RevisionRequired', 'Approved', 'Issued', 'Sent', 'Acknowledged', 'Superseded', 'Expired', 'Cancelled');

-- CreateEnum
CREATE TYPE "DocumentEtaStatus" AS ENUM ('NotApplicable', 'Pending', 'Submitted', 'Validated', 'Rejected');

-- CreateTable
CREATE TABLE "Document" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "orgId" UUID NOT NULL,
    "dealId" UUID NOT NULL,
    "companyId" UUID,
    "shipmentId" UUID,
    "specificationId" UUID,
    "documentType" "DocumentType" NOT NULL,
    "documentNumber" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "language" "DocumentLanguage" NOT NULL DEFAULT 'Arabic',
    "status" "DocumentStatus" NOT NULL DEFAULT 'Draft',
    "content" JSONB,
    "fileUrl" TEXT,
    "confidentiality" TEXT,
    "completenessScore" DECIMAL(5,2),
    "approvalId" UUID,
    "etaUuid" TEXT,
    "etaStatus" "DocumentEtaStatus" NOT NULL DEFAULT 'NotApplicable',
    "etaSubmittedAt" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Document_documentNumber_key" ON "Document"("documentNumber");

-- CreateIndex
CREATE INDEX "Document_orgId_idx" ON "Document"("orgId");

-- CreateIndex
CREATE INDEX "Document_dealId_idx" ON "Document"("dealId");

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_specificationId_fkey" FOREIGN KEY ("specificationId") REFERENCES "ProductSpecification"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_approvalId_fkey" FOREIGN KEY ("approvalId") REFERENCES "Approval"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============ Trigger: enforce_document_eta_validated — نفس فلسفة enforce_gate_aci_deadline_met
-- بالحرف (حقل يدوي، بلا تكامل حقيقي مع بوابة ETA المصرية). قيد ⚠️ صريح من docs/ERD.md §7:
-- الفاتورة التجارية B2B مش صالحة قانونًا في مصر من غير etaUuid معتمد — Document.status
-- مينفعش يوصل Issued/Sent لـdocumentType=CommercialInvoice من غير etaStatus=Validated. ============
CREATE OR REPLACE FUNCTION public.enforce_document_eta_validated()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW."documentType" = 'CommercialInvoice'
     AND NEW."status" IN ('Issued', 'Sent')
     AND NEW."etaStatus" != 'Validated' THEN
    RAISE EXCEPTION 'مينفعش تصدر/ترسل فاتورة تجارية من غير etaUuid معتمد من بوابة الضرائب المصرية (ETA) — الحالة الحالية: %', NEW."etaStatus"
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.enforce_document_eta_validated() FROM PUBLIC;

CREATE TRIGGER document_eta_validated_check
  BEFORE INSERT OR UPDATE ON "Document"
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_document_eta_validated();

-- ============ RLS: عزل orgId على Document ============
ALTER TABLE "Document" ENABLE ROW LEVEL SECURITY;
CREATE POLICY document_org_isolation ON "Document"
  FOR ALL USING ("orgId" = current_org_id()) WITH CHECK ("orgId" = current_org_id());

