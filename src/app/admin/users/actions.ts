"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireCurrentUser } from "@/lib/session";
import { requirePermission } from "@/lib/permissions";
import { getScopedPrisma, withScopedTransaction } from "@/lib/scoped-prisma";
import { logAudit } from "@/lib/audit";
import { logError, isNextControlFlowError } from "@/lib/errorLog";

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
