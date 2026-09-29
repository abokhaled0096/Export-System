-- بنود الفاتورة (InvoiceLine) — مرحلة 1 من ROADMAP.md
--
-- المشكلة اللي بيحلّها: الفاتورة كانت بتتخزّن كمبلغ مجمّع (`subtotal`) مكتوب بالإيد بلا أي
-- أصناف. فاتورة تصدير بالشكل ده مرفوضة جمركيًا ومن منظومة الفاتورة الإلكترونية المصرية (ETA)،
-- اللي بتطلب لكل بند: وصف، كود HS، كمية، وحدة، سعر وحدة، بلد منشأ.
--
-- كل الحسابات هنا على مستوى القاعدة بـTriggers مش في الواجهة — نفس مبدأ CLAUDE.md:
-- "أي قيد عمل حرج لازم يتمنع كـTrigger، مش تحقق واجهة بس". إجمالي فاتورة مكتوب بالإيد
-- بيخالف بنودها هو بالظبط نوع التناقض اللي بيوصل لقيد محاسبي غلط وقرار غلط بعده.

CREATE TABLE "InvoiceLine" (
  "id"              UUID           NOT NULL DEFAULT uuidv7(),
  "orgId"           UUID           NOT NULL,
  "invoiceId"       UUID           NOT NULL,
  "lineNumber"      INTEGER        NOT NULL,
  "productId"       UUID,
  "description"     TEXT           NOT NULL,
  "hsCode"          TEXT,
  "countryOfOrigin" TEXT,
  "quantity"        DECIMAL(14, 3) NOT NULL,
  "unit"            TEXT           NOT NULL,
  "unitPrice"       DECIMAL(14, 4) NOT NULL,
  "taxRatePct"      DECIMAL(5, 2)  NOT NULL DEFAULT 0,
  "lineTotal"       DECIMAL(14, 2) NOT NULL,
  "lineTax"         DECIMAL(14, 2) NOT NULL,
  "netWeightKg"     DECIMAL(14, 3),
  "grossWeightKg"   DECIMAL(14, 3),
  "createdAt"       TIMESTAMP(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3)   NOT NULL,

  CONSTRAINT "InvoiceLine_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- Cascade عمدًا: بند بلا فاتورة مالوش أي معنى، والفاتورة نفسها مش بتتحذف غير وهي مسودة.
ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_invoiceId_fkey"
  FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "InvoiceLine_invoiceId_lineNumber_key" ON "InvoiceLine"("invoiceId", "lineNumber");
CREATE INDEX "InvoiceLine_orgId_idx" ON "InvoiceLine"("orgId");
CREATE INDEX "InvoiceLine_invoiceId_idx" ON "InvoiceLine"("invoiceId");
CREATE INDEX "InvoiceLine_productId_idx" ON "InvoiceLine"("productId");

-- قيود قيمية أساسية: كمية موجبة، سعر غير سالب، نسبة ضريبة في مدى معقول.
ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_quantity_positive" CHECK ("quantity" > 0);
ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_unitPrice_nonneg" CHECK ("unitPrice" >= 0);
ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_taxRate_range" CHECK ("taxRatePct" >= 0 AND "taxRatePct" <= 100);

-- RLS: نفس نمط كل الجداول (عزل بالمنظمة على مستوى القاعدة).
ALTER TABLE "InvoiceLine" ENABLE ROW LEVEL SECURITY;
CREATE POLICY invoiceline_org_isolation ON "InvoiceLine"
  FOR ALL USING ("orgId" = current_org_id()) WITH CHECK ("orgId" = current_org_id());

-- ============ Trigger 1: قيم البند بتتحسب في القاعدة، مش بتتبعت من الواجهة ============
-- أي lineTotal/lineTax جاي من التطبيق بيتكتب فوقه. ده اللي بيخلّي الرقم اللي المحاسب بيشوفه
-- هو نفسه الرقم اللي القيد المحاسبي اتبنى عليه، مهما كان مصدر الكتابة (واجهة، سكريبت، SQL).
CREATE OR REPLACE FUNCTION public.compute_invoice_line_amounts()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW."lineTotal" := ROUND(NEW."quantity" * NEW."unitPrice", 2);
  NEW."lineTax"   := ROUND(NEW."lineTotal" * NEW."taxRatePct" / 100, 2);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_compute_invoice_line_amounts
  BEFORE INSERT OR UPDATE ON "InvoiceLine"
  FOR EACH ROW EXECUTE FUNCTION public.compute_invoice_line_amounts();

-- ============ Trigger 2: إجماليات الفاتورة = مجموع بنودها، دايمًا ============
-- SECURITY DEFINER عشان التجميع يشوف كل بنود الفاتورة بغض النظر عن RLS — الفاتورة نفسها
-- محمية بسياستها، والدالة دي بتشتغل بس كرد فعل لتعديل بند المستخدم أصلًا مسموح له بيه.
CREATE OR REPLACE FUNCTION public.sync_invoice_totals_from_lines()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice_id UUID := COALESCE(NEW."invoiceId", OLD."invoiceId");
  v_subtotal NUMERIC;
  v_tax NUMERIC;
BEGIN
  SELECT COALESCE(SUM("lineTotal"), 0), COALESCE(SUM("lineTax"), 0)
    INTO v_subtotal, v_tax
    FROM "InvoiceLine" WHERE "invoiceId" = v_invoice_id;

  UPDATE "Invoice"
     SET "subtotal" = v_subtotal,
         "taxAmount" = v_tax,
         "totalAmount" = v_subtotal + v_tax,
         "updatedAt" = NOW()
   WHERE "id" = v_invoice_id;

  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_sync_invoice_totals_from_lines
  AFTER INSERT OR UPDATE OR DELETE ON "InvoiceLine"
  FOR EACH ROW EXECUTE FUNCTION public.sync_invoice_totals_from_lines();

-- ============ Trigger 3: بنود الفاتورة تتقفل لحظة إصدارها ============
-- بعد الإصدار الفاتورة بقى لها قيد محاسبي مرحَّل ومستند عند العميل والجمارك. تعديل بند بعد
-- كده معناه إن الإجماليات (Trigger 2) هتتغير من تحت القيد المرحَّل وتخلّيه غير متوازن مع
-- مصدره. التعديل بعد الإصدار بيتم بإشعار خصم/إضافة (CreditNote)، مش بتحرير البند.
CREATE OR REPLACE FUNCTION public.enforce_invoice_lines_draft_only()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status TEXT;
  v_number TEXT;
BEGIN
  SELECT "status"::TEXT, "invoiceNumber" INTO v_status, v_number
    FROM "Invoice" WHERE "id" = COALESCE(NEW."invoiceId", OLD."invoiceId");

  -- فاتورة اتحذفت (ON DELETE CASCADE): البنود بتتحذف معاها وده مقبول.
  IF v_status IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;

  IF v_status <> 'Draft' THEN
    RAISE EXCEPTION 'الفاتورة % حالتها % — بنود الفاتورة ما تتعدّلش بعد الإصدار. استخدم إشعار خصم/إضافة.', v_number, v_status
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_enforce_invoice_lines_draft_only
  BEFORE INSERT OR UPDATE OR DELETE ON "InvoiceLine"
  FOR EACH ROW EXECUTE FUNCTION public.enforce_invoice_lines_draft_only();

-- ============ Trigger 4: ممنوع إصدار فاتورة بلا بنود ============
-- ده القيد اللي بيخلّي البنود إلزامية فعلًا بدل ما تبقى خانات اختيارية في فورم. من غيره
-- ممكن حد يفضل يصدّر فواتير مجمّعة زي الأول بالظبط وما حدّش ياخد باله.
CREATE OR REPLACE FUNCTION public.enforce_invoice_has_lines_on_issue()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  -- 'Issued' تحديدًا مش "أي حالة غير Draft": إلغاء مسودة فاضية (Draft→Cancelled) تصرّف
  -- مشروع وما ينفعش يترفض لمجرد إنها مالهاش بنود.
  IF NEW."status" = 'Issued' AND OLD."status" = 'Draft' THEN
    SELECT COUNT(*) INTO v_count FROM "InvoiceLine" WHERE "invoiceId" = NEW."id";
    IF v_count = 0 THEN
      RAISE EXCEPTION 'الفاتورة % مالهاش بنود — ما ينفعش تتصدر. ضيف صنف واحد على الأقل.', NEW."invoiceNumber"
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enforce_invoice_has_lines_on_issue
  BEFORE UPDATE ON "Invoice"
  FOR EACH ROW EXECUTE FUNCTION public.enforce_invoice_has_lines_on_issue();
