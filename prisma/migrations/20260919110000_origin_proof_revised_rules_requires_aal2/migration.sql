-- إصلاح عيب أمان اتلقط بمراجعة ذاتية 19 سبتمبر: نفس فئة العيب اللي اتصلح لـApproval.decision
-- (migration 20260918210000) موجودة هنا كمان — CLAUDE.md بيسمّي القيد ده بالحرف ("عبور بوابة
-- امتثال بدون تحقق revisedRulesWordingVerified ... لازم يتمنع كـTrigger ... مش تحقق واجهة بس")،
-- لكن updateOriginProofAction (compliance/actions.ts) كان بيتحقق بس requirePermission()، بلا
-- أي requireAal2() ولا Trigger DB-level. أي حد عنده صلاحية "OriginProof.Edit" عادية (aal1) كان
-- يقدر يعلّم revisedRulesWordingVerified=true بلا MFA، وTrigger enforce_gate_origin_proof_verified
-- (migration 20260830240500) بيتحقق بس إن القيمة true، مش إزاي اتحقق منها.
--
-- الحل: دالة مشتركة has_aal2() (بدل تكرار نفس التعبير في كل Trigger مستقبلي محتاج نفس الفحص)،
-- + Trigger جديد على OriginProof بنفس نمط enforce_approval_decision_requires_aal2 بالظبط.

CREATE OR REPLACE FUNCTION public.has_aal2()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (auth.jwt() ->> 'aal') = 'aal2'
$$;

REVOKE EXECUTE ON FUNCTION public.has_aal2() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_aal2() TO authenticated;

-- إعادة استخدام has_aal2() جوه Trigger الـApproval الموجود بدل التعبير المكرَّر — سلوك مطابق
-- تمامًا، تغيير تنظيمي بس (CREATE OR REPLACE بيحافظ على GRANT/REVOKE والـTrigger الموجودين).
CREATE OR REPLACE FUNCTION public.enforce_approval_decision_requires_aal2()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF NEW.decision = 'Approved' AND (TG_OP = 'INSERT' OR OLD.decision IS DISTINCT FROM 'Approved') THEN
    IF NOT public.has_aal2() THEN
      RAISE EXCEPTION 'اعتماد Approval محتاج تحقق بخطوتين (MFA aal2) — الجلسة الحالية مستواها %', COALESCE(auth.jwt() ->> 'aal', 'غير معروف')
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$fn$;

-- ============ Trigger جديد على OriginProof ============
CREATE OR REPLACE FUNCTION public.enforce_origin_proof_revised_rules_requires_aal2()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF NEW."revisedRulesWordingVerified" = true AND (TG_OP = 'INSERT' OR OLD."revisedRulesWordingVerified" IS DISTINCT FROM true) THEN
    IF NOT public.has_aal2() THEN
      RAISE EXCEPTION 'تحقّق "قواعد PEM المنقّحة" (revisedRulesWordingVerified) محتاج تحقق بخطوتين (MFA aal2) — الجلسة الحالية مستواها %', COALESCE(auth.jwt() ->> 'aal', 'غير معروف')
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.enforce_origin_proof_revised_rules_requires_aal2() FROM PUBLIC;

CREATE TRIGGER origin_proof_revised_rules_requires_aal2
  BEFORE INSERT OR UPDATE ON "OriginProof"
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_origin_proof_revised_rules_requires_aal2();
