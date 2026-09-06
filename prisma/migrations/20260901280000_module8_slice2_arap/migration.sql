-- CreateEnum
CREATE TYPE "InvoiceType" AS ENUM ('SalesInvoice', 'PurchaseInvoice', 'CreditNote', 'DebitNote', 'ProformaInvoice');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('Draft', 'Issued', 'PartiallyPaid', 'Paid', 'Overdue', 'Disputed', 'Cancelled');

-- CreateEnum
CREATE TYPE "PaymentDirection" AS ENUM ('Inbound', 'Outbound');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('BankTransfer', 'Check', 'Cash', 'LC', 'Card');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('Pending', 'Cleared', 'Bounced', 'Reversed');

-- CreateTable
CREATE TABLE "BankAccount" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "orgId" UUID NOT NULL,
    "accountName" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "accountNumber" BYTEA,
    "iban" BYTEA,
    "swift" BYTEA,
    "openingBalance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BankAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "orgId" UUID NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "invoiceType" "InvoiceType" NOT NULL,
    "dealId" UUID,
    "salesOrderId" UUID,
    "purchaseOrderId" UUID,
    "companyId" UUID,
    "supplierId" UUID,
    "documentId" UUID,
    "currency" CHAR(3) NOT NULL,
    "subtotal" DECIMAL(14,2) NOT NULL,
    "taxAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(14,2) NOT NULL,
    "amountPaid" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "issueDate" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'Draft',
    "journalEntryId" UUID,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "orgId" UUID NOT NULL,
    "paymentNumber" TEXT NOT NULL,
    "direction" "PaymentDirection" NOT NULL,
    "companyId" UUID,
    "supplierId" UUID,
    "bankAccountId" UUID NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "fxRateId" UUID,
    "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'BankTransfer',
    "paymentDate" TIMESTAMP(3) NOT NULL,
    "reference" TEXT,
    "status" "PaymentStatus" NOT NULL DEFAULT 'Pending',
    "journalEntryId" UUID,
    "createdBy" UUID NOT NULL,
    "approvedBy" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentAllocation" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "orgId" UUID NOT NULL,
    "paymentId" UUID NOT NULL,
    "invoiceId" UUID NOT NULL,
    "allocatedAmount" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BankAccount_orgId_idx" ON "BankAccount"("orgId");

-- CreateIndex
CREATE INDEX "Invoice_orgId_idx" ON "Invoice"("orgId");

-- CreateIndex
CREATE INDEX "Invoice_companyId_idx" ON "Invoice"("companyId");

-- CreateIndex
CREATE INDEX "Invoice_supplierId_idx" ON "Invoice"("supplierId");

-- CreateIndex
CREATE INDEX "Invoice_status_idx" ON "Invoice"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_orgId_invoiceNumber_key" ON "Invoice"("orgId", "invoiceNumber");

-- CreateIndex
CREATE INDEX "Payment_orgId_idx" ON "Payment"("orgId");

-- CreateIndex
CREATE INDEX "Payment_status_idx" ON "Payment"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_orgId_paymentNumber_key" ON "Payment"("orgId", "paymentNumber");

-- CreateIndex
CREATE INDEX "PaymentAllocation_orgId_idx" ON "PaymentAllocation"("orgId");

-- CreateIndex
CREATE INDEX "PaymentAllocation_invoiceId_idx" ON "PaymentAllocation"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentAllocation_paymentId_invoiceId_key" ON "PaymentAllocation"("paymentId", "invoiceId");

-- AddForeignKey
ALTER TABLE "BankAccount" ADD CONSTRAINT "BankAccount_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_fxRateId_fkey" FOREIGN KEY ("fxRateId") REFERENCES "ExchangeRate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_approvedBy_fkey" FOREIGN KEY ("approvedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ============ RLS: عزل org لكل جدول جديد ============
ALTER TABLE "BankAccount" ENABLE ROW LEVEL SECURITY;
CREATE POLICY bankaccount_org_isolation ON "BankAccount" FOR ALL USING ("orgId" = current_org_id()) WITH CHECK ("orgId" = current_org_id());

ALTER TABLE "Invoice" ENABLE ROW LEVEL SECURITY;
CREATE POLICY invoice_org_isolation ON "Invoice" FOR ALL USING ("orgId" = current_org_id()) WITH CHECK ("orgId" = current_org_id());

ALTER TABLE "Payment" ENABLE ROW LEVEL SECURITY;
CREATE POLICY payment_org_isolation ON "Payment" FOR ALL USING ("orgId" = current_org_id()) WITH CHECK ("orgId" = current_org_id());

ALTER TABLE "PaymentAllocation" ENABLE ROW LEVEL SECURITY;
CREATE POLICY paymentallocation_org_isolation ON "PaymentAllocation" FOR ALL USING ("orgId" = current_org_id()) WITH CHECK ("orgId" = current_org_id());

-- ============ 1. اتساق مبالغ الفاتورة: totalAmount = subtotal + taxAmount، وكلها ≥ 0 ============
CREATE OR REPLACE FUNCTION public.enforce_invoice_amounts_consistent()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW."subtotal" < 0 OR NEW."taxAmount" < 0 OR NEW."totalAmount" < 0 THEN
    RAISE EXCEPTION 'مبالغ الفاتورة مينفعش تكون سالبة (صافي=%، ضريبة=%، إجمالي=%)', NEW."subtotal", NEW."taxAmount", NEW."totalAmount"
      USING ERRCODE = '23514';
  END IF;

  IF NEW."totalAmount" != NEW."subtotal" + COALESCE(NEW."taxAmount", 0) THEN
    RAISE EXCEPTION 'إجمالي الفاتورة (%) لازم يساوي الصافي (%) + الضريبة (%)', NEW."totalAmount", NEW."subtotal", COALESCE(NEW."taxAmount", 0)
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.enforce_invoice_amounts_consistent() FROM PUBLIC;

CREATE TRIGGER invoice_amounts_consistent_check
  BEFORE INSERT OR UPDATE ON "Invoice"
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_invoice_amounts_consistent();

-- ============ 2. ⚠️ امتداد القيد القانوني للفاتورة الإلكترونية للطبقة المحاسبية ============
-- docs/ERD.md سطر 264/266: الفاتورة B2B مش صالحة قانونًا في مصر بلا etaUuid معتمد (غرامة 20 ألف
-- + 1000 يوميًا). الـTrigger الموجود بيحمي Document؛ ده بيحمي السجل المحاسبي المقابل (Invoice).
CREATE OR REPLACE FUNCTION public.enforce_invoice_eta_validated()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_eta_status TEXT;
BEGIN
  IF NEW."invoiceType" = 'SalesInvoice'
     AND NEW."status" = 'Issued'
     AND (TG_OP = 'INSERT' OR OLD."status" IS DISTINCT FROM 'Issued') THEN

    IF NEW."documentId" IS NULL THEN
      RAISE EXCEPTION 'مينفعش إصدار فاتورة مبيعات بلا مستند قانوني مربوط — الفاتورة B2B مش صالحة قانونًا في مصر بلا etaUuid معتمد من بوابة الضرائب'
        USING ERRCODE = '23514';
    END IF;

    SELECT "etaStatus"::text INTO v_eta_status FROM "Document" WHERE id = NEW."documentId";

    IF v_eta_status IS DISTINCT FROM 'Validated' THEN
      RAISE EXCEPTION 'مينفعش إصدار فاتورة مبيعات — المستند القانوني المربوط حالة ETA بتاعته (%) مش Validated. الفاتورة B2B مش صالحة قانونًا بلا etaUuid معتمد', COALESCE(v_eta_status, 'غير موجود')
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.enforce_invoice_eta_validated() FROM PUBLIC;

CREATE TRIGGER invoice_eta_validated_check
  BEFORE INSERT OR UPDATE ON "Invoice"
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_invoice_eta_validated();

-- ============ 3. حدود التخصيص: منع التخصيص الزائد وعابر العملات ============
CREATE OR REPLACE FUNCTION public.enforce_payment_allocation_limits()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice_total NUMERIC;
  v_invoice_currency TEXT;
  v_invoice_number TEXT;
  v_payment_amount NUMERIC;
  v_payment_currency TEXT;
  v_payment_number TEXT;
  v_allocated_to_invoice NUMERIC;
  v_allocated_from_payment NUMERIC;
BEGIN
  SELECT "totalAmount", "currency", "invoiceNumber"
    INTO v_invoice_total, v_invoice_currency, v_invoice_number
    FROM "Invoice" WHERE id = NEW."invoiceId";

  SELECT "amount", "currency", "paymentNumber"
    INTO v_payment_amount, v_payment_currency, v_payment_number
    FROM "Payment" WHERE id = NEW."paymentId";

  IF NEW."allocatedAmount" <= 0 THEN
    RAISE EXCEPTION 'مبلغ التخصيص لازم يكون أكبر من صفر' USING ERRCODE = '23514';
  END IF;

  -- منع التخصيص عابر العملات — اتساقًا مع منع القيود متعددة العملات (enforce_journal_entry_balanced)
  IF v_invoice_currency IS DISTINCT FROM v_payment_currency THEN
    RAISE EXCEPTION 'مينفعش تخصيص دفعة بعملة % على فاتورة بعملة % — التخصيص عابر العملات محتاج محرك تحويل بسعر صرف فعلي (مش مبني لسه)', v_payment_currency, v_invoice_currency
      USING ERRCODE = '23514';
  END IF;

  SELECT COALESCE(SUM("allocatedAmount"), 0) INTO v_allocated_to_invoice
    FROM "PaymentAllocation"
    WHERE "invoiceId" = NEW."invoiceId" AND id IS DISTINCT FROM NEW.id;

  IF v_allocated_to_invoice + NEW."allocatedAmount" > v_invoice_total THEN
    RAISE EXCEPTION 'التخصيص بيتجاوز إجمالي الفاتورة % — المخصّص حاليًا %، المطلوب إضافته %، الإجمالي %', v_invoice_number, v_allocated_to_invoice, NEW."allocatedAmount", v_invoice_total
      USING ERRCODE = '23514';
  END IF;

  SELECT COALESCE(SUM("allocatedAmount"), 0) INTO v_allocated_from_payment
    FROM "PaymentAllocation"
    WHERE "paymentId" = NEW."paymentId" AND id IS DISTINCT FROM NEW.id;

  IF v_allocated_from_payment + NEW."allocatedAmount" > v_payment_amount THEN
    RAISE EXCEPTION 'التخصيص بيتجاوز مبلغ الدفعة % — المخصّص حاليًا %، المطلوب إضافته %، مبلغ الدفعة %', v_payment_number, v_allocated_from_payment, NEW."allocatedAmount", v_payment_amount
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.enforce_payment_allocation_limits() FROM PUBLIC;

CREATE TRIGGER payment_allocation_limits_check
  BEFORE INSERT OR UPDATE ON "PaymentAllocation"
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_payment_allocation_limits();

-- ============ 4. مزامنة amountPaid وحالة الفاتورة تلقائيًا من التخصيصات ============
-- الحل الجذري لعيب المواصفة: status فيه PartiallyPaid/Paid كقيم مخزَّنة يدويًا رغم إنها مشتقّة.
-- amountPaid ممنوع أي كود يكتبه بإيد — الـTrigger ده هو المصدر الوحيد للحقيقة.
CREATE OR REPLACE FUNCTION public.sync_invoice_payment_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice_id UUID;
  v_total NUMERIC;
  v_paid NUMERIC;
  v_status TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_invoice_id := OLD."invoiceId";
  ELSE
    v_invoice_id := NEW."invoiceId";
  END IF;

  SELECT "totalAmount", "status"::text INTO v_total, v_status FROM "Invoice" WHERE id = v_invoice_id;

  -- بس التخصيصات المرتبطة بدفعات محصّلة فعلًا (Cleared) بتُحتسب — الدفعة المعلّقة أو المرتدّة
  -- مش تحصيل حقيقي.
  SELECT COALESCE(SUM(pa."allocatedAmount"), 0) INTO v_paid
    FROM "PaymentAllocation" pa
    JOIN "Payment" p ON p.id = pa."paymentId"
    WHERE pa."invoiceId" = v_invoice_id AND p."status" = 'Cleared';

  UPDATE "Invoice"
    SET "amountPaid" = v_paid,
        "status" = CASE
          WHEN v_status IN ('Draft', 'Cancelled', 'Disputed') THEN "status"
          WHEN v_paid >= v_total AND v_total > 0 THEN 'Paid'::"InvoiceStatus"
          WHEN v_paid > 0 THEN 'PartiallyPaid'::"InvoiceStatus"
          ELSE 'Issued'::"InvoiceStatus"
        END
    WHERE id = v_invoice_id;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.sync_invoice_payment_status() FROM PUBLIC;

CREATE TRIGGER payment_allocation_sync_invoice
  AFTER INSERT OR UPDATE OR DELETE ON "PaymentAllocation"
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_invoice_payment_status();

-- تغيّر حالة الدفعة (Pending→Cleared→Bounced) بيأثر على المحصّل — لازم يعيد المزامنة كمان.
CREATE OR REPLACE FUNCTION public.sync_invoices_on_payment_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
  v_total NUMERIC;
  v_paid NUMERIC;
  v_status TEXT;
BEGIN
  IF NEW."status" IS DISTINCT FROM OLD."status" THEN
    FOR r IN SELECT DISTINCT "invoiceId" FROM "PaymentAllocation" WHERE "paymentId" = NEW.id LOOP
      SELECT "totalAmount", "status"::text INTO v_total, v_status FROM "Invoice" WHERE id = r."invoiceId";
      SELECT COALESCE(SUM(pa."allocatedAmount"), 0) INTO v_paid
        FROM "PaymentAllocation" pa
        JOIN "Payment" p ON p.id = pa."paymentId"
        WHERE pa."invoiceId" = r."invoiceId" AND p."status" = 'Cleared';

      UPDATE "Invoice"
        SET "amountPaid" = v_paid,
            "status" = CASE
              WHEN v_status IN ('Draft', 'Cancelled', 'Disputed') THEN "status"
              WHEN v_paid >= v_total AND v_total > 0 THEN 'Paid'::"InvoiceStatus"
              WHEN v_paid > 0 THEN 'PartiallyPaid'::"InvoiceStatus"
              ELSE 'Issued'::"InvoiceStatus"
            END
        WHERE id = r."invoiceId";
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.sync_invoices_on_payment_status_change() FROM PUBLIC;

CREATE TRIGGER payment_status_sync_invoices
  AFTER UPDATE ON "Payment"
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_invoices_on_payment_status_change();

-- ============ 5. منع تعديل مبالغ فاتورة مقفولة (مدفوعة/ملغاة) ============
CREATE OR REPLACE FUNCTION public.enforce_invoice_amounts_immutable_when_closed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD."status" IN ('Paid', 'Cancelled')
     AND (NEW."subtotal" IS DISTINCT FROM OLD."subtotal"
          OR NEW."taxAmount" IS DISTINCT FROM OLD."taxAmount"
          OR NEW."totalAmount" IS DISTINCT FROM OLD."totalAmount"
          OR NEW."currency" IS DISTINCT FROM OLD."currency") THEN
    RAISE EXCEPTION 'مبالغ الفاتورة % مايتغيّروش — حالتها % (التصحيح بإشعار دائن/مدين، مش تعديل)', OLD."invoiceNumber", OLD."status"
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.enforce_invoice_amounts_immutable_when_closed() FROM PUBLIC;

CREATE TRIGGER invoice_amounts_immutable_when_closed_check
  BEFORE UPDATE ON "Invoice"
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_invoice_amounts_immutable_when_closed();
