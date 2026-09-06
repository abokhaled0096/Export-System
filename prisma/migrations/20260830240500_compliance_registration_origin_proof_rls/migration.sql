-- تفعيل RLS على Registration/OriginProof (نفس نمط باقي جداول وحدة 5) + Trigger ثالث إلزامي على
-- Gate (مع الاتنين الموجودين من الشريحة الأولى): قواعد PEM المنقّحة لإثبات المنشأ المصري —
-- سارية فعليًا من يناير 2026 (CLAUDE.md §مواعيد نهائية قانونية). أي Gate بعلامة
-- requiresOriginProofVerification=true لازم تتحقق من OriginProof.revisedRulesWordingVerified=true
-- قبل ما تعدّي Passed/PassedWithConditions — Trigger على مستوى القاعدة، مش تحقق واجهة بس.

ALTER TABLE "Registration" ENABLE ROW LEVEL SECURITY;
CREATE POLICY registration_org_isolation ON "Registration"
  FOR ALL USING ("orgId" = current_org_id()) WITH CHECK ("orgId" = current_org_id());

ALTER TABLE "OriginProof" ENABLE ROW LEVEL SECURITY;
CREATE POLICY origin_proof_org_isolation ON "OriginProof"
  FOR ALL USING ("orgId" = current_org_id()) WITH CHECK ("orgId" = current_org_id());

-- ============ Trigger 3 على Gate: منع Passed/PassedWithConditions لو OriginProof مش متحقّق ============
CREATE OR REPLACE FUNCTION public.enforce_gate_origin_proof_verified()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deal_id UUID;
  v_unverified_count INTEGER;
BEGIN
  IF NEW."status" NOT IN ('Passed', 'PassedWithConditions') OR NOT NEW."requiresOriginProofVerification" THEN
    RETURN NEW;
  END IF;

  SELECT "dealId" INTO v_deal_id FROM "ComplianceCase" WHERE id = NEW."complianceCaseId";

  SELECT COUNT(*) INTO v_unverified_count
  FROM "OriginProof"
  WHERE "dealId" = v_deal_id
    AND "usesRevisedPemRules" = true
    AND "revisedRulesWordingVerified" = false;

  IF v_unverified_count > 0 THEN
    RAISE EXCEPTION 'مينفعش تعدّي بوابة الشحن دي — فيه % إثبات منشأ بيستخدم قواعد PEM المنقّحة بس عبارة "revised rules" الإلزامية لسه مش متحقّق منها', v_unverified_count
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.enforce_gate_origin_proof_verified() FROM PUBLIC;

CREATE TRIGGER gate_origin_proof_verified_check
  BEFORE INSERT OR UPDATE ON "Gate"
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_gate_origin_proof_verified();
