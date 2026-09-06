-- تفعيل RLS على جداول P2 (شريحة أولى) — نفس نمط الـmigrations السابقة بالظبط، + Trigger
-- إلزامي لمنع أي Quote.unitPrice تحت DealScenario.walkAwayPrice بلا موافقة استثنائية معتمدة
-- (CLAUDE.md، قاعدة أمان غير قابلة للتفاوض — يجب Trigger/RLS على مستوى القاعدة، مش تحقق واجهة).

ALTER TABLE "ExchangeRate" ENABLE ROW LEVEL SECURITY;
CREATE POLICY exchange_rate_org_isolation ON "ExchangeRate"
  FOR ALL USING ("orgId" = current_org_id()) WITH CHECK ("orgId" = current_org_id());

ALTER TABLE "ApprovalPolicy" ENABLE ROW LEVEL SECURITY;
CREATE POLICY approval_policy_org_isolation ON "ApprovalPolicy"
  FOR ALL USING ("orgId" = current_org_id()) WITH CHECK ("orgId" = current_org_id());

ALTER TABLE "Approval" ENABLE ROW LEVEL SECURITY;
CREATE POLICY approval_org_isolation ON "Approval"
  FOR ALL USING ("orgId" = current_org_id()) WITH CHECK ("orgId" = current_org_id());

ALTER TABLE "Deal" ENABLE ROW LEVEL SECURITY;
CREATE POLICY deal_org_isolation ON "Deal"
  FOR ALL USING ("orgId" = current_org_id()) WITH CHECK ("orgId" = current_org_id());

ALTER TABLE "DealScenario" ENABLE ROW LEVEL SECURITY;
CREATE POLICY deal_scenario_org_isolation ON "DealScenario"
  FOR ALL USING ("orgId" = current_org_id()) WITH CHECK ("orgId" = current_org_id());

ALTER TABLE "CostItem" ENABLE ROW LEVEL SECURITY;
CREATE POLICY cost_item_org_isolation ON "CostItem"
  FOR ALL USING ("orgId" = current_org_id()) WITH CHECK ("orgId" = current_org_id());

ALTER TABLE "Quote" ENABLE ROW LEVEL SECURITY;
CREATE POLICY quote_org_isolation ON "Quote"
  FOR ALL USING ("orgId" = current_org_id()) WITH CHECK ("orgId" = current_org_id());

-- ============ Trigger: منع Quote.unitPrice < DealScenario.walkAwayPrice بلا موافقة معتمدة ============
-- SECURITY DEFINER عشان يقدر يقرأ DealScenario/Approval بصلاحيات المالك، مش دور الطالب —
-- نفس منطق current_org_id() (الملف الأصلي للـRLS)، لتفادي أي تعقيد RLS إضافي جوه الـTrigger نفسه.
CREATE OR REPLACE FUNCTION public.enforce_quote_walk_away_price()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_walk_away NUMERIC;
  v_approved BOOLEAN;
BEGIN
  SELECT "walkAwayPrice" INTO v_walk_away FROM "DealScenario" WHERE id = NEW."scenarioId";

  IF v_walk_away IS NULL OR NEW."unitPrice" >= v_walk_away THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM "Approval"
    WHERE "subjectType" = 'Quote.unitPrice_override'
      AND "subjectId" = NEW.id
      AND "decision" = 'Approved'
  ) INTO v_approved;

  IF NOT v_approved THEN
    RAISE EXCEPTION 'سعر الوحدة (%) أقل من الحد الأدنى المسموح (walkAwayPrice = %) — لازم موافقة استثنائية معتمدة (Approval.subjectType = ''Quote.unitPrice_override'') قبل الحفظ', NEW."unitPrice", v_walk_away
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.enforce_quote_walk_away_price() FROM PUBLIC;

CREATE TRIGGER quote_walk_away_price_check
  BEFORE INSERT OR UPDATE ON "Quote"
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_quote_walk_away_price();
