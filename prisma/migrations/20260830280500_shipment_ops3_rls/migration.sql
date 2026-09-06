-- تفعيل RLS على TemperatureLog/TransportTrip/Claim — عزل orgId عادي بلا Trigger.

ALTER TABLE "TemperatureLog" ENABLE ROW LEVEL SECURITY;
CREATE POLICY temperature_log_org_isolation ON "TemperatureLog"
  FOR ALL USING ("orgId" = current_org_id()) WITH CHECK ("orgId" = current_org_id());

ALTER TABLE "TransportTrip" ENABLE ROW LEVEL SECURITY;
CREATE POLICY transport_trip_org_isolation ON "TransportTrip"
  FOR ALL USING ("orgId" = current_org_id()) WITH CHECK ("orgId" = current_org_id());

ALTER TABLE "Claim" ENABLE ROW LEVEL SECURITY;
CREATE POLICY claim_org_isolation ON "Claim"
  FOR ALL USING ("orgId" = current_org_id()) WITH CHECK ("orgId" = current_org_id());
