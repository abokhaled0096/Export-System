-- تفعيل RLS على SalesOrder/SalesOrderLine — نفس نمط باقي الـmigrations بالظبط.

ALTER TABLE "SalesOrder" ENABLE ROW LEVEL SECURITY;
CREATE POLICY sales_order_org_isolation ON "SalesOrder"
  FOR ALL USING ("orgId" = current_org_id()) WITH CHECK ("orgId" = current_org_id());

ALTER TABLE "SalesOrderLine" ENABLE ROW LEVEL SECURITY;
CREATE POLICY sales_order_line_org_isolation ON "SalesOrderLine"
  FOR ALL USING ("orgId" = current_org_id()) WITH CHECK ("orgId" = current_org_id());
