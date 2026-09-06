-- تفعيل RLS على ShipmentEvent/LogisticsException/FreeTimeRecord/ActualLogisticsCost — عزل orgId
-- عادي بلا Trigger (نفس فلسفة RejectionCase/LCRequirement في وحدة 5 الشريحة الثالثة).

ALTER TABLE "ShipmentEvent" ENABLE ROW LEVEL SECURITY;
CREATE POLICY shipment_event_org_isolation ON "ShipmentEvent"
  FOR ALL USING ("orgId" = current_org_id()) WITH CHECK ("orgId" = current_org_id());

ALTER TABLE "LogisticsException" ENABLE ROW LEVEL SECURITY;
CREATE POLICY logistics_exception_org_isolation ON "LogisticsException"
  FOR ALL USING ("orgId" = current_org_id()) WITH CHECK ("orgId" = current_org_id());

ALTER TABLE "FreeTimeRecord" ENABLE ROW LEVEL SECURITY;
CREATE POLICY free_time_record_org_isolation ON "FreeTimeRecord"
  FOR ALL USING ("orgId" = current_org_id()) WITH CHECK ("orgId" = current_org_id());

ALTER TABLE "ActualLogisticsCost" ENABLE ROW LEVEL SECURITY;
CREATE POLICY actual_logistics_cost_org_isolation ON "ActualLogisticsCost"
  FOR ALL USING ("orgId" = current_org_id()) WITH CHECK ("orgId" = current_org_id());
