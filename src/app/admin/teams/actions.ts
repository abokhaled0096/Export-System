"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireCurrentUser } from "@/lib/session";
import { requirePermission } from "@/lib/permissions";
import { getScopedPrisma, withScopedTransaction } from "@/lib/scoped-prisma";
import { logAudit } from "@/lib/audit";
import { logError, isNextControlFlowError } from "@/lib/errorLog";

// إدارة الفرق/الأقسام — نفس صلاحية `User.Edit` المستخدمة فعليًا في /admin/users لتعيين الأدوار
// (نفس فئة "إدارة الهيكل التنظيمي")، بدل ما نخترع صلاحية جديدة مش موجودة في كتالوج prisma/seed.ts.

const CreateDepartmentSchema = z.object({
  name: z.string().trim().min(2, "اسم القسم لازم يكون حرفين على الأقل"),
});

export type CreateDepartmentFormState = { errors?: Record<string, string[]>; formError?: string };

export async function createDepartment(
  _prevState: CreateDepartmentFormState,
  formData: FormData
): Promise<CreateDepartmentFormState> {
  const parsed = CreateDepartmentSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const user = await requireCurrentUser();
  try {
    await requirePermission(user.roleId, "User", "Edit");
  } catch {
    return { formError: "معندكش صلاحية إدارة الهيكل التنظيمي." };
  }

  try {
    await withScopedTransaction(async (tx) => {
      const department = await tx.department.create({ data: { orgId: user.orgId, name: parsed.data.name } });
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "department.created",
        entityType: "Department",
        entityId: department.id,
        afterValue: { name: parsed.data.name },
      });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "createDepartment", error: e });
    return { formError: "حصل خطأ أثناء إنشاء القسم — حاول تاني." };
  }

  revalidatePath("/admin/teams");
  return {};
}

const CreateTeamSchema = z.object({
  name: z.string().trim().min(2, "اسم الفريق لازم يكون حرفين على الأقل"),
  departmentId: z.string().uuid("لازم تختار قسم"),
  managerId: z.string().uuid().optional().or(z.literal("")),
});

export type CreateTeamFormState = { errors?: Record<string, string[]>; formError?: string };

export async function createTeam(
  _prevState: CreateTeamFormState,
  formData: FormData
): Promise<CreateTeamFormState> {
  const parsed = CreateTeamSchema.safeParse({
    name: formData.get("name"),
    departmentId: formData.get("departmentId"),
    managerId: formData.get("managerId") || undefined,
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const user = await requireCurrentUser();
  try {
    await requirePermission(user.roleId, "User", "Edit");
  } catch {
    return { formError: "معندكش صلاحية إدارة الهيكل التنظيمي." };
  }

  const { name, departmentId, managerId } = parsed.data;

  try {
    // departmentId إلزامي وبيتعرض بلا `?.` في `/admin/teams` (`t.department.name`) — لازم
    // يتحقق قبل الإنشاء (اتكشف في مراجعة وحدة 9، 6 سبتمبر).
    const scopedPrisma = await getScopedPrisma();
    const department = await scopedPrisma.department.findFirst({ where: { id: departmentId } });
    if (!department) return { formError: "القسم غير موجود." };
    // managerId اختياري جاي من الفورم — لازم يتأكد إنه فعلًا بتاع نفس المنظمة قبل الإنشاء
    // (اتكشف في إعادة مراجعة وحدة 9، 7 سبتمبر).
    if (managerId) {
      const manager = await scopedPrisma.user.findFirst({ where: { id: managerId } });
      if (!manager) return { formError: "المدير غير موجود." };
    }
    await withScopedTransaction(async (tx) => {
      const team = await tx.team.create({
        data: { orgId: user.orgId, name, departmentId, managerId: managerId || undefined },
      });
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "team.created",
        entityType: "Team",
        entityId: team.id,
        afterValue: { name, departmentId, managerId: managerId || null },
      });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "createTeam", error: e });
    return { formError: "حصل خطأ أثناء إنشاء الفريق — حاول تاني." };
  }

  revalidatePath("/admin/teams");
  return {};
}

const AssignUserTeamSchema = z.object({
  userId: z.string().uuid(),
  teamId: z.string().uuid().optional().or(z.literal("")),
});

export type AssignUserTeamFormState = { formError?: string };

export async function assignUserTeam(
  _prevState: AssignUserTeamFormState,
  formData: FormData
): Promise<AssignUserTeamFormState> {
  const rawTeamId = formData.get("teamId");
  const parsed = AssignUserTeamSchema.safeParse({
    userId: formData.get("userId"),
    // "__none__" = sentinel القيمة "بلا فريق" من TeamAssignForm (Base UI Select مايقبلش value فاضية).
    teamId: rawTeamId === "__none__" ? undefined : rawTeamId || undefined,
  });
  if (!parsed.success) return { formError: "بيانات غير صحيحة." };

  const user = await requireCurrentUser();
  try {
    await requirePermission(user.roleId, "User", "Edit");
  } catch {
    return { formError: "معندكش صلاحية تعيين الفرق." };
  }

  const prisma = await getScopedPrisma();
  const target = await prisma.user.findUnique({ where: { id: parsed.data.userId } });
  if (!target) return { formError: "المستخدم غير موجود." };

  const teamId = parsed.data.teamId || null;
  // teamId اختياري جاي من الفورم — لازم يتأكد إنه فعلًا بتاع نفس المنظمة قبل التعيين. `User.teamId`
  // بيتستخدم بعدين في `scopedOwnerIdFilter` (src/lib/permissions.ts) عبر الـprisma الخام (بلا فلترة
  // orgId خالص) عشان يجيب كل أعضاء نفس الفريق — teamId عابر للمنظمة كان هيرجّع ids مستخدمين من
  // منظمة تانية في نتيجة الفلترة دي (بلا تسريب بيانات فعلي لأن كل استعلام لاحق بيتفلتر بـorgId
  // المستخدم الحالي أصلًا، لكن لسه تلوّث بيانات مش مقصود — اتكشف في إعادة مراجعة وحدة 9، 7 سبتمبر).
  if (teamId) {
    const team = await prisma.team.findFirst({ where: { id: teamId } });
    if (!team) return { formError: "الفريق غير موجود." };
  }

  try {
    await withScopedTransaction(async (tx) => {
      await tx.user.update({ where: { id: parsed.data.userId }, data: { teamId } });
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "user.teamAssigned",
        entityType: "User",
        entityId: parsed.data.userId,
        beforeValue: { teamId: target.teamId },
        afterValue: { teamId },
      });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "assignUserTeam", error: e });
    return { formError: "حصل خطأ أثناء تعيين الفريق — حاول تاني." };
  }

  revalidatePath("/admin/teams");
  return {};
}
