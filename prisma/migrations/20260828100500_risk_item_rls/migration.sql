-- تفعيل RLS على RiskItem — نفس نمط باقي الـmigrations بالظبط.

ALTER TABLE "RiskItem" ENABLE ROW LEVEL SECURITY;
CREATE POLICY risk_item_org_isolation ON "RiskItem"
  FOR ALL USING ("orgId" = current_org_id()) WITH CHECK ("orgId" = current_org_id());
