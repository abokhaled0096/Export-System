-- تفعيل RLS على جداول وحدة 9 (الشريحة الأولى) — نفس نمط 20260826142111_enable_rls بالظبط.

ALTER TABLE "Role" ENABLE ROW LEVEL SECURITY;
CREATE POLICY role_org_isolation ON "Role"
  FOR ALL USING ("orgId" = current_org_id()) WITH CHECK ("orgId" = current_org_id());

ALTER TABLE "Department" ENABLE ROW LEVEL SECURITY;
CREATE POLICY department_org_isolation ON "Department"
  FOR ALL USING ("orgId" = current_org_id()) WITH CHECK ("orgId" = current_org_id());

ALTER TABLE "Team" ENABLE ROW LEVEL SECURITY;
CREATE POLICY team_org_isolation ON "Team"
  FOR ALL USING ("orgId" = current_org_id()) WITH CHECK ("orgId" = current_org_id());

-- Permission: كتالوج عالمي بلا orgId — مقروء للجميع، والكتابة عليه مش من التطبيق العادي حاليًا
-- (بلا Policy INSERT/UPDATE/DELETE يعني ممنوعة افتراضيًا لدور authenticated).
ALTER TABLE "Permission" ENABLE ROW LEVEL SECURITY;
CREATE POLICY permission_read_all ON "Permission"
  FOR SELECT USING (true);

-- RolePermission: معزول عبر orgId بتاع الـRole المرتبط بيه (مفيش orgId مباشر على الجدول نفسه).
ALTER TABLE "RolePermission" ENABLE ROW LEVEL SECURITY;
CREATE POLICY role_permission_org_isolation ON "RolePermission"
  FOR ALL USING (
    "roleId" IN (SELECT id FROM "Role" WHERE "orgId" = current_org_id())
  ) WITH CHECK (
    "roleId" IN (SELECT id FROM "Role" WHERE "orgId" = current_org_id())
  );
