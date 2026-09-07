import { prisma } from "./prisma";
import type { PermissionAction, PermissionScope, FieldAccessLevel } from "@/generated/prisma/enums";

/**
 * فحص صلاحية مستخدم على مورد معيّن (وحدة 9، شريحة RBAC الأولى — راجع STATUS.md).
 * بيرجّع الـscope (Own/Team/Org) لو الدور عنده الصلاحية، أو null لو معندوش.
 * الاستدعاء الفعلي على orgId المستخدم بيتم عبر RLS على مستوى القاعدة (role_permission_org_isolation) —
 * الدالة دي طبقة تطبيقية إضافية لعرض/منع أفعال في الواجهة والـServer Actions، مش بديل عن RLS.
 */
export async function getPermissionScope(
  roleId: string,
  resource: string,
  action: PermissionAction
) {
  const rolePermission = await prisma.rolePermission.findFirst({
    where: { roleId, permission: { resource, action } },
  });
  return rolePermission?.scope ?? null;
}

/** يرمي لو المستخدم مفيهوش الصلاحية المطلوبة — للاستخدام في أول Server Action حساس. */
export async function requirePermission(
  roleId: string,
  resource: string,
  action: PermissionAction
) {
  const scope = await getPermissionScope(roleId, resource, action);
  if (!scope) {
    throw new Error(`صلاحية غير كافية: ${resource}.${action}`);
  }
  return scope;
}

/**
 * يرمي لو المستخدم مش مسموحله بالمورد حسب الـscope:
 * - Own: لازم يكون هو نفسه المالك (`ownerId`).
 * - Team: لازم يكون المالك عضو في نفس فريق المستخدم الحالي (`User.teamId`) — أو هو نفسه المالك.
 *   مستخدم من غير فريق (`teamId === null`) بيتعامل كأنه Own فعليًا (مفيش فريق يوسّع الصلاحية بيه).
 * - Org (أو أي scope تاني): بيعدّي من غير فحص إضافي.
 * استخدمها بعد `requirePermission()` في أي فعل بيلمس مورد ليه سلسلة ملكية (Opportunity/Company
 * أو أي كيان تابع ليهم زي Deal/DealScenario/Quote عبر opportunity.ownerId).
 */
export async function assertOwnScope(
  scope: PermissionScope,
  ownerId: string | null | undefined,
  user: { id: string; teamId: string | null }
) {
  if (scope === "Own") {
    if (ownerId !== user.id) {
      throw new Error("المورد ده ملك مستخدم تاني — صلاحيتك محدودة بالحاجات اللي انت مالكها (Own scope).");
    }
    return;
  }

  if (scope === "Team") {
    if (ownerId === user.id) return;
    if (!ownerId || !user.teamId) {
      throw new Error("المورد ده مش تابع لفريقك — صلاحيتك محدودة بحاجات فريقك (Team scope).");
    }
    const owner = await prisma.user.findUnique({ where: { id: ownerId }, select: { teamId: true } });
    if (!owner || owner.teamId !== user.teamId) {
      throw new Error("المورد ده ملك مستخدم برّه فريقك — صلاحيتك محدودة بحاجات فريقك (Team scope).");
    }
  }
}

/**
 * بيرجّع قيمة فلتر `ownerId` Prisma-compatible حسب الـscope (أو `undefined` لو بلا فلترة إضافية):
 * - Own: `user.id`.
 * - Team: `{ in: [...] }` بأعضاء فريق المستخدم الحالي (لو معندوش فريق، بيتصرف زي Own).
 * - غير كده (Org أو null): `undefined`.
 * الشكل خام (مش `{ownerId: ...}`) عشان يتلائم مع فلاتر متداخلة زي `{ opportunity: { ownerId: ... } }`
 * (Deal/SalesOrder ملهومش `ownerId` مباشر — الملكية عبر Opportunity).
 */
export async function scopedOwnerIdFilter(
  scope: PermissionScope | null,
  user: { id: string; teamId: string | null }
): Promise<string | { in: string[] } | undefined> {
  if (scope === "Own") return user.id;

  if (scope === "Team") {
    if (!user.teamId) return user.id;
    const members = await prisma.user.findMany({ where: { teamId: user.teamId }, select: { id: true } });
    return { in: members.map((m) => m.id) };
  }

  return undefined;
}

/**
 * بيرجّع فلتر `{ownerId: ...}` جاهز حسب الـscope، للاستخدام في صفحات القوائم/التصدير اللي عندها
 * `ownerId` مباشر (Company/Opportunity). للحالات المتداخلة (Deal.opportunity.ownerId) استخدم
 * `scopedOwnerIdFilter()` مباشرة وحطّها في مكانها المناسب جوه الـwhere.
 */
export async function ownerScopeWhere(
  scope: PermissionScope | null,
  user: { id: string; teamId: string | null }
): Promise<{ ownerId?: string | { in: string[] } }> {
  const value = await scopedOwnerIdFilter(scope, user);
  return value === undefined ? {} : { ownerId: value };
}

/**
 * صلاحية عرض/تعديل على مستوى الحقل (وحدة 9، FieldPermission — راجع STATUS.md، 7 سبتمبر).
 * طبقة تضييق إضافية فوق RolePermission (اللي بيتحكم في الوصول للمورد كله)، مش بديل عنها.
 * الغياب (مفيش صف) = "ReadWrite" افتراضيًا (بلا تقييد إضافي) — إضافة حقل جديد للنظام
 * متطلبش تسجيل صف لكل دور موجود.
 */
export async function getFieldAccess(
  roleId: string,
  entityType: string,
  fieldName: string
): Promise<FieldAccessLevel> {
  const fieldPermission = await prisma.fieldPermission.findUnique({
    where: { roleId_entityType_fieldName: { roleId, entityType, fieldName } },
  });
  return fieldPermission?.accessLevel ?? "ReadWrite";
}
