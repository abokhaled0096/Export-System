"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireCurrentUser } from "@/lib/session";
import { requirePermission } from "@/lib/permissions";
import { getScopedPrisma, withScopedTransaction } from "@/lib/scoped-prisma";
import { logAudit } from "@/lib/audit";
import { logError, isNextControlFlowError, businessRuleMessage } from "@/lib/errorLog";
import { createAuthUser, updateAuthUserPassword, deleteAuthUser } from "@/lib/authAdmin";

const AssignRoleSchema = z.object({
  userId: z.string().uuid(),
  roleId: z.string().uuid(),
});

export type AssignRoleFormState = { formError?: string };

/** تعيين دور لمستخدم — الاستخدام الوحيد فعليًا لـ`User.Edit` (راجع BACKLOG.md P0 — تفعيل RBAC). */
export async function assignUserRole(
  _prevState: AssignRoleFormState,
  formData: FormData
): Promise<AssignRoleFormState> {
  const parsed = AssignRoleSchema.safeParse({
    userId: formData.get("userId"),
    roleId: formData.get("roleId"),
  });
  if (!parsed.success) return { formError: "بيانات غير صحيحة." };

  const user = await requireCurrentUser();
  try {
    await requirePermission(user.roleId, "User", "Edit");
  } catch {
    return { formError: "معندكش صلاحية تعيين الأدوار." };
  }

  const prisma = await getScopedPrisma();
  const target = await prisma.user.findUnique({ where: { id: parsed.data.userId } });
  if (!target) return { formError: "المستخدم غير موجود." };
  const role = await prisma.role.findUnique({ where: { id: parsed.data.roleId } });
  if (!role) return { formError: "الدور غير موجود." };

  try {
    await withScopedTransaction(async (tx) => {
      await tx.user.update({ where: { id: parsed.data.userId }, data: { roleId: parsed.data.roleId } });
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "user.roleAssigned",
        entityType: "User",
        entityId: parsed.data.userId,
        beforeValue: { roleId: target.roleId },
        afterValue: { roleId: parsed.data.roleId },
      });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "assignUserRole", error: e });
    return { formError: "حصل خطأ أثناء تحديث الدور — حاول تاني." };
  }

  revalidatePath("/admin/users");
  return {};
}

const CreateUserSchema = z.object({
  email: z.string().trim().email("إيميل غير صالح"),
  fullName: z.string().trim().min(1, "الاسم مطلوب"),
  roleId: z.string().uuid("اختر دور"),
  password: z.string().min(6, "كلمة المرور قصيرة جدًا"),
});

export type CreateUserFormState = { errors?: Record<string, string[]>; formError?: string };

/** بيحل محل الخطوة اليدوية (Supabase Dashboard + prisma/link-auth-user.ts) — الأدمن بيحدّد كلمة
 * سر ابتدائية هنا، مش المستخدم الجديد (نفس فلسفة "الأدمن بيتحكّم بالحسابات" اللي طلبها المستخدم). */
export async function createUserAction(_prevState: CreateUserFormState, formData: FormData): Promise<CreateUserFormState> {
  const parsed = CreateUserSchema.safeParse({
    email: formData.get("email"),
    fullName: formData.get("fullName"),
    roleId: formData.get("roleId"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const user = await requireCurrentUser();
  try {
    await requirePermission(user.roleId, "User", "Edit");
  } catch {
    return { formError: "معندكش صلاحية إضافة مستخدمين." };
  }

  const { email, fullName, roleId, password } = parsed.data;
  const scopedPrisma = await getScopedPrisma();
  const role = await scopedPrisma.role.findFirst({ where: { id: roleId, orgId: user.orgId } });
  if (!role) return { formError: "الدور غير موجود." };
  const existing = await scopedPrisma.user.findFirst({ where: { email } });
  if (existing) return { formError: "الإيميل ده مسجّل بالفعل." };

  let authUserId: string;
  try {
    authUserId = (await createAuthUser(email, password)).id;
  } catch (e) {
    await logError({ orgId: user.orgId, userId: user.id, action: "createUserAction.auth", error: e });
    return { formError: businessRuleMessage(e, "حصل خطأ أثناء إنشاء حساب المصادقة — حاول تاني.") };
  }

  try {
    await withScopedTransaction(async (tx) => {
      await tx.user.create({ data: { id: authUserId, orgId: user.orgId, roleId, fullName, email } });
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "user.created",
        entityType: "User",
        entityId: authUserId,
        afterValue: { email, fullName, roleId },
      });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await deleteAuthUser(authUserId);
    await logError({ orgId: user.orgId, userId: user.id, action: "createUserAction.link", error: e });
    return { formError: "حصل خطأ أثناء ربط المستخدم — حاول تاني." };
  }

  revalidatePath("/admin/users");
  return {};
}

const ResetPasswordSchema = z.object({
  userId: z.string().uuid(),
  password: z.string().min(6, "كلمة المرور قصيرة جدًا"),
});

export type ResetPasswordFormState = { errors?: Record<string, string[]>; formError?: string; success?: boolean };

/** الأدمن بيقدر يعيد تعيين كلمة سر أي مستخدم في أي وقت — مفيش قراءة/عرض للقيمة القديمة خالص،
 * مستحيل تقنيًا (كلمات السر مشفّرة اتجاه واحد). */
export async function resetUserPasswordAction(
  _prevState: ResetPasswordFormState,
  formData: FormData
): Promise<ResetPasswordFormState> {
  const parsed = ResetPasswordSchema.safeParse({
    userId: formData.get("userId"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const user = await requireCurrentUser();
  try {
    await requirePermission(user.roleId, "User", "Edit");
  } catch {
    return { formError: "معندكش صلاحية تغيير كلمات السر." };
  }

  const scopedPrisma = await getScopedPrisma();
  const target = await scopedPrisma.user.findFirst({ where: { id: parsed.data.userId } });
  if (!target) return { formError: "المستخدم غير موجود." };

  try {
    await updateAuthUserPassword(parsed.data.userId, parsed.data.password);
    await withScopedTransaction(async (tx) => {
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "user.passwordReset",
        entityType: "User",
        entityId: parsed.data.userId,
      });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "resetUserPasswordAction", error: e });
    return { formError: businessRuleMessage(e, "حصل خطأ أثناء تغيير كلمة السر — حاول تاني.") };
  }

  revalidatePath("/admin/users");
  return { success: true };
}

const ToggleActiveSchema = z.object({
  userId: z.string().uuid(),
  isActive: z.coerce.boolean(),
});

export type ToggleActiveFormState = { formError?: string };

/** تعطيل فوري — أقوى وأسرع من إعادة تعيين كلمة السر لأنه بيقفل الدخول بغض النظر عن أي كلمة سر
 * المستخدم عارفها (مفعّل فعليًا في src/lib/session.ts's requireCurrentUser). */
export async function toggleUserActiveAction(
  _prevState: ToggleActiveFormState,
  formData: FormData
): Promise<ToggleActiveFormState> {
  const parsed = ToggleActiveSchema.safeParse({
    userId: formData.get("userId"),
    isActive: formData.get("isActive") === "true",
  });
  if (!parsed.success) return { formError: "بيانات غير صحيحة." };

  const user = await requireCurrentUser();
  if (parsed.data.userId === user.id) return { formError: "معندكش تعطّل حسابك إنت." };
  try {
    await requirePermission(user.roleId, "User", "Edit");
  } catch {
    return { formError: "معندكش صلاحية تفعيل/تعطيل المستخدمين." };
  }

  const scopedPrisma = await getScopedPrisma();
  const target = await scopedPrisma.user.findFirst({ where: { id: parsed.data.userId } });
  if (!target) return { formError: "المستخدم غير موجود." };

  try {
    await withScopedTransaction(async (tx) => {
      await tx.user.update({ where: { id: parsed.data.userId }, data: { isActive: parsed.data.isActive } });
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: parsed.data.isActive ? "user.activated" : "user.deactivated",
        entityType: "User",
        entityId: parsed.data.userId,
        beforeValue: { isActive: target.isActive },
        afterValue: { isActive: parsed.data.isActive },
      });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "toggleUserActiveAction", error: e });
    return { formError: "حصل خطأ أثناء تحديث حالة المستخدم — حاول تاني." };
  }

  revalidatePath("/admin/users");
  return {};
}
