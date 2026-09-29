-- سد ثغرة في 20260929100000_invoice_lines: فحص "ممنوع إصدار فاتورة بلا بنود" كان على
-- UPDATE بس. يعني INSERT مباشر بـstatus='Issued' كان بيتخطّى الفحص كله ويخلّف فاتورة
-- مُصدَرة بمبلغ مجمّع بلا أي صنف — بالظبط الحالة اللي المرحلة دي موجودة عشانها.
--
-- الحل: الفاتورة لازم تتولد مسودة. القاعدة دي متسقة مع Trigger enforce_invoice_lines_draft_only
-- في نفس الهجرة — البنود ما تتضافش لفاتورة مش مسودة، فـ"اتولدت مُصدَرة" معناها حرفيًا
-- "مستحيل يبقى ليها بنود أبدًا".

CREATE OR REPLACE FUNCTION public.enforce_invoice_has_lines_on_issue()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW."status" <> 'Draft' THEN
      RAISE EXCEPTION 'الفاتورة % لازم تتعمل كمسودة الأول — ضيف بنودها وبعدين اصدرها.', NEW."invoiceNumber"
        USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
  END IF;

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

DROP TRIGGER IF EXISTS trg_enforce_invoice_has_lines_on_issue ON "Invoice";
CREATE TRIGGER trg_enforce_invoice_has_lines_on_issue
  BEFORE INSERT OR UPDATE ON "Invoice"
  FOR EACH ROW EXECUTE FUNCTION public.enforce_invoice_has_lines_on_issue();
