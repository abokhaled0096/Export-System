-- تفعيل RLS على جداول وحدة 5 (الامتثال والجمارك، شريحة أولى) — نفس نمط الـmigrations السابقة
-- بالظبط + Triggerين إلزاميين (CLAUDE.md، قاعدة أمان غير قابلة للتفاوض — أي قيد عمل حرج لازم
-- Trigger/RLS على مستوى القاعدة، مش تحقق واجهة بس):
-- (1) Gate.status='Waived' لازم يكون معاه Approval معتمد فعليًا (نفس نمط enforce_quote_walk_away_price).
-- (2) Gate.status='Passed'/'PassedWithConditions' لازم كل Requirement في blockingRequirementIds
--     تكون Met أو NotApplicable — نفس "بوابة الموافقات الشكلية" اللي كل RLS Tester في المشروع
--     مصمّم يكشفها (راجع docs/ERD.md §8 حواشي الإنفاذ).

ALTER TABLE "ComplianceCase" ENABLE ROW LEVEL SECURITY;
CREATE POLICY compliance_case_org_isolation ON "ComplianceCase"
  FOR ALL USING ("orgId" = current_org_id()) WITH CHECK ("orgId" = current_org_id());

ALTER TABLE "Requirement" ENABLE ROW LEVEL SECURITY;
CREATE POLICY requirement_org_isolation ON "Requirement"
  FOR ALL USING ("orgId" = current_org_id()) WITH CHECK ("orgId" = current_org_id());

ALTER TABLE "Gate" ENABLE ROW LEVEL SECURITY;
CREATE POLICY gate_org_isolation ON "Gate"
  FOR ALL USING ("orgId" = current_org_id()) WITH CHECK ("orgId" = current_org_id());

ALTER TABLE "HSClassification" ENABLE ROW LEVEL SECURITY;
CREATE POLICY hs_classification_org_isolation ON "HSClassification"
  FOR ALL USING ("orgId" = current_org_id()) WITH CHECK ("orgId" = current_org_id());

ALTER TABLE "Certificate" ENABLE ROW LEVEL SECURITY;
CREATE POLICY certificate_org_isolation ON "Certificate"
  FOR ALL USING ("orgId" = current_org_id()) WITH CHECK ("orgId" = current_org_id());

-- ============ Trigger 1: منع Gate.status='Waived' بلا Approval معتمد فعليًا ============
CREATE OR REPLACE FUNCTION public.enforce_gate_waiver_requires_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_approved BOOLEAN;
BEGIN
  IF NEW."status" != 'Waived' THEN
    RETURN NEW;
  END IF;

  IF NEW."approvalId" IS NULL THEN
    RAISE EXCEPTION 'تجاوز البوابة (Waived) لازم يكون معاه approvalId — اطلب موافقة استثنائية الأول'
      USING ERRCODE = '23514';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM "Approval"
    WHERE id = NEW."approvalId"
      AND "subjectType" = 'Gate.waiver'
      AND "subjectId" = NEW.id
      AND "decision" = 'Approved'
  ) INTO v_approved;

  IF NOT v_approved THEN
    RAISE EXCEPTION 'تجاوز البوابة (Waived) محتاج موافقة استثنائية معتمدة فعليًا (Approval.decision = ''Approved'')، مش بس approvalId موجود'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.enforce_gate_waiver_requires_approval() FROM PUBLIC;

CREATE TRIGGER gate_waiver_requires_approval
  BEFORE INSERT OR UPDATE ON "Gate"
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_gate_waiver_requires_approval();

-- ============ Trigger 2: منع Gate.status='Passed'/'PassedWithConditions' لو فيه متطلب حاجب مش Met ============
CREATE OR REPLACE FUNCTION public.enforce_gate_pass_requires_met_requirements()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_blocking_count INTEGER;
BEGIN
  IF NEW."status" NOT IN ('Passed', 'PassedWithConditions') THEN
    RETURN NEW;
  END IF;

  IF NEW."blockingRequirementIds" IS NULL OR array_length(NEW."blockingRequirementIds", 1) IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO v_blocking_count
  FROM "Requirement"
  WHERE id = ANY (NEW."blockingRequirementIds"::uuid[])
    AND "status" NOT IN ('Met', 'NotApplicable');

  IF v_blocking_count > 0 THEN
    RAISE EXCEPTION 'مينفعش تعدّي البوابة (Passed) — فيه % متطلب حاجب لسه مش Met/NotApplicable', v_blocking_count
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.enforce_gate_pass_requires_met_requirements() FROM PUBLIC;

CREATE TRIGGER gate_pass_requires_met_requirements
  BEFORE INSERT OR UPDATE ON "Gate"
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_gate_pass_requires_met_requirements();
