-- تفعيل RLS حقيقي على مستوى القاعدة (ERD v3 §1.4، CLAUDE.md قواعد الأمان).
-- الاتصال من التطبيق بيتم عادة بدور postgres (Superuser) اللي بيتخطى RLS تلقائيًا —
-- الإنفاذ الفعلي محتاج الاتصال عبر src/lib/scoped-prisma.ts اللي بيعمل
-- SET LOCAL ROLE authenticated + SET LOCAL request.jwt.claims لكل معاملة.
--
-- Supabase بيدي anon/authenticated/service_role صلاحيات CRUD كاملة افتراضيًا على
-- أي جدول جديد في public schema (default privileges) — يعني RLS Policies هي
-- البوابة الفعلية، مش الصلاحيات نفسها. اتأكدنا من ده قبل كتابة الملف ده.

-- ============ current_org_id(): SECURITY DEFINER لتجنب Recursion على User ============
-- بيشتغل بصلاحيات المالك (postgres، بيتخطى RLS بنيويًا) عشان القراءة من "User" هنا
-- ماتتلخبطش مع RLS Policy المفروضة على "User" نفسها (Circular reference لو معمول
-- الاستعلام بصلاحيات الطالب العادي).
CREATE OR REPLACE FUNCTION public.current_org_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT "orgId" FROM "User" WHERE id = auth.uid() LIMIT 1
$$;

REVOKE EXECUTE ON FUNCTION public.current_org_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_org_id() TO authenticated;

-- ============ Organization ============
ALTER TABLE "Organization" ENABLE ROW LEVEL SECURITY;
CREATE POLICY org_isolation ON "Organization"
  FOR ALL USING (id = current_org_id());

-- ============ User ============
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_org_isolation ON "User"
  FOR ALL USING ("orgId" = current_org_id());

-- ============ AuditLog: Insert-only فعليًا (ERD v3 §3) ============
-- REVOKE على مستوى الصلاحيات نفسها، مش بس Policy — ممنوع UPDATE/DELETE حتى
-- لمدير النظام، وده أقوى ضمان من مجرد غياب Policy.
ALTER TABLE "AuditLog" ENABLE ROW LEVEL SECURITY;
CREATE POLICY auditlog_select ON "AuditLog"
  FOR SELECT USING ("orgId" = current_org_id());
CREATE POLICY auditlog_insert ON "AuditLog"
  FOR INSERT WITH CHECK ("orgId" = current_org_id());
REVOKE UPDATE, DELETE ON "AuditLog" FROM authenticated, anon;

-- ============ الكيانات التشغيلية — orgId = current_org_id() قراءة وكتابة ============
ALTER TABLE "Product" ENABLE ROW LEVEL SECURITY;
CREATE POLICY product_org_isolation ON "Product"
  FOR ALL USING ("orgId" = current_org_id()) WITH CHECK ("orgId" = current_org_id());

ALTER TABLE "Market" ENABLE ROW LEVEL SECURITY;
CREATE POLICY market_org_isolation ON "Market"
  FOR ALL USING ("orgId" = current_org_id()) WITH CHECK ("orgId" = current_org_id());

ALTER TABLE "ProductMarketAnalysis" ENABLE ROW LEVEL SECURITY;
CREATE POLICY pma_org_isolation ON "ProductMarketAnalysis"
  FOR ALL USING ("orgId" = current_org_id()) WITH CHECK ("orgId" = current_org_id());

ALTER TABLE "Company" ENABLE ROW LEVEL SECURITY;
CREATE POLICY company_org_isolation ON "Company"
  FOR ALL USING ("orgId" = current_org_id()) WITH CHECK ("orgId" = current_org_id());

ALTER TABLE "Contact" ENABLE ROW LEVEL SECURITY;
CREATE POLICY contact_org_isolation ON "Contact"
  FOR ALL USING ("orgId" = current_org_id()) WITH CHECK ("orgId" = current_org_id());

ALTER TABLE "Opportunity" ENABLE ROW LEVEL SECURITY;
CREATE POLICY opportunity_org_isolation ON "Opportunity"
  FOR ALL USING ("orgId" = current_org_id()) WITH CHECK ("orgId" = current_org_id());
