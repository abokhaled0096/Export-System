-- إصلاح عيب فادح اتلقط فورًا بالاختبار الحي بعد migration 20260919110000: has_aal2() كانت بترجع
-- SQL NULL (مش false) لما aal claim يكون NULL، لأن `NULL = 'aal2'` بترجع NULL في منطق SQL
-- ثلاثي القيم — و`NOT NULL` جوه IF في plpgsql بتتقيّم كـ"مش true"، يعني الشرط ما بيتحققش خالص
-- والـTrigger كان بيسمح بالعملية بدل ما يرفضها. النتيجة: enforce_approval_decision_requires_aal2
-- وenforce_origin_proof_revised_rules_requires_aal2 الاتنين كانوا فعليًا بلا أي حماية MFA حقيقية
-- من لحظة الـrefactor لـhas_aal2() لحد الإصلاح ده — اتلقط بس محلي (اختبار SQL مباشر) قبل أي نشر،
-- مفيش نافذة تعرّض فعلي.
--
-- الحل: COALESCE صريح يضمن قيمة boolean محدَّدة دايمًا (false لو الـclaim مفقود/NULL)، مش قيمة
-- three-valued logic ممكن تتفلت من فحص IF.

CREATE OR REPLACE FUNCTION public.has_aal2()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((auth.jwt() ->> 'aal') = 'aal2', false)
$$;
