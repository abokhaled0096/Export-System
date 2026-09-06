-- تفعيل RLS على RejectionCase/LCRequirement (نفس نمط باقي جداول وحدة 5). مفيش Trigger هنا —
-- على عكس OriginProof/Gate، مفيش قيد عمل حرج (Hard Business Rule) مذكور في docs/ERD.md §8
-- بيتعلق بالكيانين دول؛ الاتنين توثيق بيانات (CRUD) بلا منطق إنفاذ.

ALTER TABLE "RejectionCase" ENABLE ROW LEVEL SECURITY;
CREATE POLICY rejection_case_org_isolation ON "RejectionCase"
  FOR ALL USING ("orgId" = current_org_id()) WITH CHECK ("orgId" = current_org_id());

ALTER TABLE "LCRequirement" ENABLE ROW LEVEL SECURITY;
CREATE POLICY lc_requirement_org_isolation ON "LCRequirement"
  FOR ALL USING ("orgId" = current_org_id()) WITH CHECK ("orgId" = current_org_id());
