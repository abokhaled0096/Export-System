-- ============ الوحدة 9 (شريحة أولى) — استبدال enum "Role" الثابت بجداول حقيقية ============
-- ERD v4 §12. الشريحة المختارة: Role, Permission, RolePermission, Department, Team بس —
-- راجع STATUS.md لسبب تأجيل باقي الـ8 كيانات (FieldPermission, WorkflowDefinition...).

CREATE TYPE "PermissionAction" AS ENUM ('View', 'Create', 'Edit', 'Delete', 'Approve', 'Export');
CREATE TYPE "PermissionScope" AS ENUM ('Own', 'Team', 'Org');

-- الـenum القديم "Role" بياخد نفس اسم النوع اللي جدول "Role" الجديد هيحتاجه (Postgres بيولّد composite
-- type بنفس اسم أي جدول تلقائيًا) — لازم نفكّ الاسم عنه الأول بإعادة تسمية، مش حذف (لسه محتاجينه للتحويل تحت).
ALTER TYPE "Role" RENAME TO "RoleOld";

CREATE TABLE "Role" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "orgId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isSystemRole" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Role_orgId_idx" ON "Role"("orgId");
CREATE UNIQUE INDEX "Role_orgId_name_key" ON "Role"("orgId", "name");
ALTER TABLE "Role" ADD CONSTRAINT "Role_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "Permission" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "resource" TEXT NOT NULL,
    "action" "PermissionAction" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Permission_resource_action_key" ON "Permission"("resource", "action");

CREATE TABLE "RolePermission" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "roleId" UUID NOT NULL,
    "permissionId" UUID NOT NULL,
    "scope" "PermissionScope" NOT NULL,
    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "RolePermission_roleId_idx" ON "RolePermission"("roleId");
CREATE UNIQUE INDEX "RolePermission_roleId_permissionId_key" ON "RolePermission"("roleId", "permissionId");
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "Department" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "orgId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "parentDepartmentId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Department_orgId_idx" ON "Department"("orgId");
ALTER TABLE "Department" ADD CONSTRAINT "Department_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Department" ADD CONSTRAINT "Department_parentDepartmentId_fkey" FOREIGN KEY ("parentDepartmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "Team" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "orgId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "departmentId" UUID NOT NULL,
    "managerId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Team_orgId_idx" ON "Team"("orgId");
ALTER TABLE "Team" ADD CONSTRAINT "Team_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Team" ADD CONSTRAINT "Team_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Team" ADD CONSTRAINT "Team_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============ User: roleId/teamId مؤقتًا NULL-able لحد ما تتملى من البيانات القديمة ============
ALTER TABLE "User" ADD COLUMN "roleId" UUID;
ALTER TABLE "User" ADD COLUMN "teamId" UUID;

-- ============ بذر الأدوار التسعة الافتراضية (isSystemRole) لكل Organization موجودة فعليًا ============
INSERT INTO "Role" ("id", "orgId", "name", "description", "isSystemRole", "updatedAt")
SELECT uuidv7(), o."id", r.name, r.name, true, CURRENT_TIMESTAMP
FROM "Organization" o
CROSS JOIN (VALUES
  ('SalesRep'), ('SalesManager'), ('Finance'), ('ComplianceOfficer'),
  ('ProcurementOfficer'), ('QualityManager'), ('LogisticsOfficer'),
  ('CompanyOwner'), ('Admin')
) AS r(name)
ON CONFLICT ("orgId", "name") DO NOTHING;

-- ============ تحويل User.role (enum قديم) → User.roleId (FK) قبل ما العمود يتشال ============
UPDATE "User" u
SET "roleId" = r."id"
FROM "Role" r
WHERE r."orgId" = u."orgId" AND r."name" = u."role"::text;

ALTER TABLE "User" ALTER COLUMN "roleId" SET NOT NULL;
ALTER TABLE "User" ADD CONSTRAINT "User_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "User" ADD CONSTRAINT "User_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "User_roleId_idx" ON "User"("roleId");

ALTER TABLE "User" DROP COLUMN "role";
DROP TYPE "RoleOld";

-- ============ كتالوج Permission أساسي (يتوسع مع بناء P2) ============
INSERT INTO "Permission" ("id", "resource", "action")
SELECT uuidv7(), res, act::"PermissionAction"
FROM (VALUES ('Opportunity'), ('Deal'), ('Quote'), ('Company')) AS r(res)
CROSS JOIN (VALUES ('View'), ('Create'), ('Edit'), ('Delete'), ('Approve'), ('Export')) AS a(act)
ON CONFLICT ("resource", "action") DO NOTHING;

-- ============ RolePermission افتراضية: Admin = كل شيء Org-scope، الباقي View/Create/Edit على Own مبدئيًا ============
-- ملاحظة: دي صلاحيات مبدئية فضفاضة معقولة، مش التصميم النهائي — هتتضيّق فعليًا مع بناء P2 نفسه.
INSERT INTO "RolePermission" ("id", "roleId", "permissionId", "scope")
SELECT uuidv7(), r."id", p."id", 'Org'
FROM "Role" r
JOIN "Permission" p ON true
WHERE r."name" = 'Admin'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

INSERT INTO "RolePermission" ("id", "roleId", "permissionId", "scope")
SELECT uuidv7(), r."id", p."id", 'Own'
FROM "Role" r
JOIN "Permission" p ON p."action" IN ('View', 'Create', 'Edit')
WHERE r."name" <> 'Admin'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
