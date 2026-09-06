-- تفعيل RLS على Shipment/ShipmentParty/Booking/Container/Milestone (نفس نمط باقي جداول الوحدة 5) +
-- Trigger رابع إلزامي على Gate (مع الثلاثة الموجودين): مهلة ACI (48 ساعة) — سارية فعليًا الآن
-- (CLAUDE.md §مواعيد نهائية قانونية: بحري إلزامي من 2021، جوي إلزامي من يناير 2026). أي Gate بعلامة
-- requiresAciVerification=true لازم تتحقق إن مفيش شحنة مرتبطة بنفس ComplianceCase عندها
-- aciDeadlineMet=false وaciStatus != NotRequired قبل ما تعدّي Passed/PassedWithConditions —
-- Trigger على مستوى القاعدة، مش تحقق واجهة بس (نفس فلسفة enforce_gate_origin_proof_verified:
-- بتفحص عدم وجود صف "غير متحقّق"، مش بتشترط وجود صف "متحقّق" أصلًا).

ALTER TABLE "Shipment" ENABLE ROW LEVEL SECURITY;
CREATE POLICY shipment_org_isolation ON "Shipment"
  FOR ALL USING ("orgId" = current_org_id()) WITH CHECK ("orgId" = current_org_id());

ALTER TABLE "ShipmentParty" ENABLE ROW LEVEL SECURITY;
CREATE POLICY shipment_party_org_isolation ON "ShipmentParty"
  FOR ALL USING ("orgId" = current_org_id()) WITH CHECK ("orgId" = current_org_id());

ALTER TABLE "Booking" ENABLE ROW LEVEL SECURITY;
CREATE POLICY booking_org_isolation ON "Booking"
  FOR ALL USING ("orgId" = current_org_id()) WITH CHECK ("orgId" = current_org_id());

ALTER TABLE "Container" ENABLE ROW LEVEL SECURITY;
CREATE POLICY container_org_isolation ON "Container"
  FOR ALL USING ("orgId" = current_org_id()) WITH CHECK ("orgId" = current_org_id());

ALTER TABLE "Milestone" ENABLE ROW LEVEL SECURITY;
CREATE POLICY milestone_org_isolation ON "Milestone"
  FOR ALL USING ("orgId" = current_org_id()) WITH CHECK ("orgId" = current_org_id());

-- ============ Trigger 4 على Gate: منع Passed/PassedWithConditions لو مهلة ACI مش متحقّقة ============
CREATE OR REPLACE FUNCTION public.enforce_gate_aci_deadline_met()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_unmet_count INTEGER;
BEGIN
  IF NEW."status" NOT IN ('Passed', 'PassedWithConditions') OR NOT NEW."requiresAciVerification" THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO v_unmet_count
  FROM "Shipment"
  WHERE "complianceCaseId" = NEW."complianceCaseId"
    AND "aciStatus" != 'NotRequired'
    AND "aciDeadlineMet" = false;

  IF v_unmet_count > 0 THEN
    RAISE EXCEPTION 'مينفعش تعدّي بوابة الشحن دي — فيه % شحنة لسه ما استوفتش مهلة تصدير ACID الإلزامية (48 ساعة قبل المغادرة)', v_unmet_count
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.enforce_gate_aci_deadline_met() FROM PUBLIC;

CREATE TRIGGER gate_aci_deadline_met_check
  BEFORE INSERT OR UPDATE ON "Gate"
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_gate_aci_deadline_met();
