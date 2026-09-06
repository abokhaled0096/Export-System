-- تفعيل تدفّق Verify/Close حقيقي لـCAPA — كان create-only، الأعمدة verifiedBy/status
-- موجودة بالفعل بس بلا أي قيد. راجع BACKLOG.md/STATUS.md (2 سبتمبر) للسياق الكامل.
--
-- عيبان اتلقطوا في المراجعة قبل البناء:
-- 1. status=Overdue كان قابل للكتابة اليدوية وقت الإنشاء — نفس عيب Invoice.Overdue/
--    LoanInstallment.Overdue اللي اتصلح قبل كده: حالة زمنية مخزَّنة بتبقى قديمة لحظة كتابتها.
-- 2. مفيش قيد يمنع status→Closed/Effective/Ineffective بلا verifiedBy — نفس فئة عيب
--    TaxRecord.filingStatus=Paid بلا دفعة، وBankReconciliation.status=Reconciled بلا تحقق.
CREATE OR REPLACE FUNCTION public.enforce_capa_verification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF NEW."status" = 'Overdue' THEN
    RAISE EXCEPTION '"متأخر" حالة محسوبة من dueDate وقت العرض — مينفعش تتخزّن كـstatus مباشرة'
      USING ERRCODE = '23514';
  END IF;

  IF NEW."status" IN ('Effective', 'Ineffective', 'Closed') AND NEW."verifiedBy" IS NULL THEN
    RAISE EXCEPTION 'مينفعش تأكيد الحالة "%" بلا تسجيل مين تحقق منها (verifiedBy)', NEW."status"
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.enforce_capa_verification() FROM PUBLIC;

CREATE TRIGGER capa_verification_check
  BEFORE INSERT OR UPDATE ON "CAPA"
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_capa_verification();
