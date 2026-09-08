-- HardClosed حالة نهائية بلا رجوع (راجع WorkflowDefinition seed — مفيش أي صف fromStage
-- HardClosed خالص). advanceAccountingPeriodStatus في التطبيق بيمنع الانتقال ده عن طريق
-- assertWorkflowTransitionAllowed، لكن ده فحص طبقة التطبيق بس — أي وصول مباشر لقاعدة
-- البيانات (SQL console, migration خاطئة، إلخ) كان يقدر يتخطاه. القيد ده حرج بنفس فئة
-- enforce_accounting_period_not_hard_closed (بيمنع لمس بنود القيود جوه فترة مقفولة)،
-- فلازم يتفرض على مستوى القاعدة زي القواعد الحرجة التانية (CLAUDE.md، اتكشف بمراجعة كود 8 سبتمبر).
CREATE OR REPLACE FUNCTION public.enforce_accounting_period_hard_close_immutable()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD."status" = 'HardClosed' AND NEW."status" IS DISTINCT FROM OLD."status" THEN
    RAISE EXCEPTION 'الفترة المحاسبية "%" مقفولة نهائيًا (HardClosed) — لا يمكن تغيير حالتها', OLD."periodName"
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.enforce_accounting_period_hard_close_immutable() FROM PUBLIC;

DROP TRIGGER IF EXISTS accounting_period_hard_close_immutable_check ON "AccountingPeriod";

CREATE TRIGGER accounting_period_hard_close_immutable_check
  BEFORE UPDATE ON "AccountingPeriod"
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_accounting_period_hard_close_immutable();
