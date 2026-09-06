-- تفعيل RLS على ServiceProvider/Route/FreightQuote/FreightQuoteLine — عزل orgId عادي بلا Trigger.

ALTER TABLE "ServiceProvider" ENABLE ROW LEVEL SECURITY;
CREATE POLICY service_provider_org_isolation ON "ServiceProvider"
  FOR ALL USING ("orgId" = current_org_id()) WITH CHECK ("orgId" = current_org_id());

ALTER TABLE "Route" ENABLE ROW LEVEL SECURITY;
CREATE POLICY route_org_isolation ON "Route"
  FOR ALL USING ("orgId" = current_org_id()) WITH CHECK ("orgId" = current_org_id());

ALTER TABLE "FreightQuote" ENABLE ROW LEVEL SECURITY;
CREATE POLICY freight_quote_org_isolation ON "FreightQuote"
  FOR ALL USING ("orgId" = current_org_id()) WITH CHECK ("orgId" = current_org_id());

ALTER TABLE "FreightQuoteLine" ENABLE ROW LEVEL SECURITY;
CREATE POLICY freight_quote_line_org_isolation ON "FreightQuoteLine"
  FOR ALL USING ("orgId" = current_org_id()) WITH CHECK ("orgId" = current_org_id());
