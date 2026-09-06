-- تفعيل RLS على ShipmentLot (نفس نمط باقي الوحدة) — بلا Trigger، الـERD مش بيحدد قيد عمل حرج
-- صريح على الجدول الوسيط ده (توثيق بيانات بس، نفس فلسفة ShipmentEvent/ActualLogisticsCost/RejectionCase).

ALTER TABLE "ShipmentLot" ENABLE ROW LEVEL SECURITY;
CREATE POLICY shipment_lot_org_isolation ON "ShipmentLot"
  FOR ALL USING ("orgId" = current_org_id()) WITH CHECK ("orgId" = current_org_id());
