-- إصلاح عيب اتكشف بمراجعة ذاتية: جدول "Approval" كان عليه بس عزل orgId (RLS)، بلا أي قيد على
-- مستوى القاعدة يمنع تغيير decision لـ'Approved' بدون MFA — الفحص (requireAal2 في
-- src/lib/mfa.ts) كان تطبيقي بحت. أي حد عنده جلسة مصادقة (حتى aal1 بلا MFA) كان يقدر نظريًا
-- ينده PostgREST مباشرة (PATCH /rest/v1/Approval) ويتجاوز requirePermission()/requireAal2()
-- في approvals/actions.ts بالكامل — والـTriggers الحالية (enforce_quote_walk_away_price،
-- enforce_purchase_order_max_price، gate_waiver_requires_approval) بتتحقق بس إن صف Approved
-- موجود، مش إزاي اتوافق عليه.
--
-- الحل: نفس نمط auth.uid() (current_org_id مبني عليه) — auth.jwt() بيقرأ نفس الـGUC
-- request.jwt.claims اللي src/lib/scoped-prisma.ts بيحطه يدويًا لكل استعلام Prisma، وبقى
-- فيه aal دلوقتي (بعد تعديل scoped-prisma.ts). لو حد استخدم PostgREST مباشرة بجلسة Supabase
-- حقيقية، Supabase نفسه بيحط aal الحقيقي في نفس الـclaim، فالفحص ده بيغطي المسارين.

CREATE OR REPLACE FUNCTION public.enforce_approval_decision_requires_aal2()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF NEW.decision = 'Approved' AND (TG_OP = 'INSERT' OR OLD.decision IS DISTINCT FROM 'Approved') THEN
    IF (auth.jwt() ->> 'aal') IS DISTINCT FROM 'aal2' THEN
      RAISE EXCEPTION 'اعتماد Approval محتاج تحقق بخطوتين (MFA aal2) — الجلسة الحالية مستواها %', COALESCE(auth.jwt() ->> 'aal', 'غير معروف')
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.enforce_approval_decision_requires_aal2() FROM PUBLIC;

CREATE TRIGGER approval_decision_requires_aal2
  BEFORE INSERT OR UPDATE ON "Approval"
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_approval_decision_requires_aal2();
