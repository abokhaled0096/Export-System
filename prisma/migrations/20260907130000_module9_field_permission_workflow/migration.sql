-- إكمال وحدة 9 (الحوكمة والإدارة) لـ13/13 كيان — FieldPermission + WorkflowDefinition، آخر
-- كيانين متبقّيين من ERD v4 §12. اتبنوا استباقيًا كبنية تحتية عامة بطلب صريح من المستخدم (7
-- سبتمبر) بعد ما كانوا مؤجَّلين لغياب حالة استخدام تانية. راجع STATUS.md/BACKLOG.md.

-- ============ FieldPermission ============

CREATE TYPE "FieldAccessLevel" AS ENUM ('Hidden', 'ReadOnly', 'ReadWrite');

CREATE TABLE "FieldPermission" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "roleId" UUID NOT NULL,
    "entityType" TEXT NOT NULL,
    "fieldName" TEXT NOT NULL,
    "accessLevel" "FieldAccessLevel" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FieldPermission_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "FieldPermission_roleId_idx" ON "FieldPermission"("roleId");
CREATE UNIQUE INDEX "FieldPermission_roleId_entityType_fieldName_key" ON "FieldPermission"("roleId", "entityType", "fieldName");
ALTER TABLE "FieldPermission" ADD CONSTRAINT "FieldPermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- معزول عبر orgId بتاع الـRole المرتبط بيه (مفيش orgId مباشر على الجدول نفسه) — نفس نمط RolePermission بالحرف.
ALTER TABLE "FieldPermission" ENABLE ROW LEVEL SECURITY;
CREATE POLICY field_permission_org_isolation ON "FieldPermission"
  FOR ALL USING (
    "roleId" IN (SELECT id FROM "Role" WHERE "orgId" = current_org_id())
  ) WITH CHECK (
    "roleId" IN (SELECT id FROM "Role" WHERE "orgId" = current_org_id())
  );

-- ============ WorkflowDefinition ============

CREATE TABLE "WorkflowDefinition" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "orgId" UUID NOT NULL,
    "entityType" TEXT NOT NULL,
    "fromStage" TEXT NOT NULL,
    "toStage" TEXT NOT NULL,
    "requiredApprovalPolicyId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkflowDefinition_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "WorkflowDefinition_orgId_idx" ON "WorkflowDefinition"("orgId");
CREATE UNIQUE INDEX "WorkflowDefinition_orgId_entityType_fromStage_toStage_key" ON "WorkflowDefinition"("orgId", "entityType", "fromStage", "toStage");
ALTER TABLE "WorkflowDefinition" ADD CONSTRAINT "WorkflowDefinition_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkflowDefinition" ADD CONSTRAINT "WorkflowDefinition_requiredApprovalPolicyId_fkey" FOREIGN KEY ("requiredApprovalPolicyId") REFERENCES "ApprovalPolicy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "WorkflowDefinition" ENABLE ROW LEVEL SECURITY;
CREATE POLICY workflow_definition_org_isolation ON "WorkflowDefinition"
  FOR ALL USING ("orgId" = current_org_id()) WITH CHECK ("orgId" = current_org_id());
