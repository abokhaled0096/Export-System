import { requireCurrentUser } from "@/lib/session";
import { requirePermission } from "@/lib/permissions";
import { getScopedPrisma } from "@/lib/scoped-prisma";
import { getCurrentOrgId } from "@/lib/org";
import RoleSelectForm from "./RoleSelectForm";
import CreateUserForm from "./CreateUserForm";
import ResetPasswordForm from "./ResetPasswordForm";
import ToggleActiveForm from "./ToggleActiveForm";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const user = await requireCurrentUser();

  try {
    await requirePermission(user.roleId, "User", "Edit");
  } catch {
    return (
      <main className="mx-auto max-w-3xl px-6 py-10">
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-6 text-center text-sm text-rose-700">
          معندكش صلاحية الوصول للصفحة دي — إدارة الأدوار متاحة لـAdmin/CompanyOwner بس.
        </div>
      </main>
    );
  }

  const orgId = await getCurrentOrgId();
  const prisma = await getScopedPrisma();
  // ⚠️ مش Promise.all — راجع BACKLOG.md (P2028).
  const users = await prisma.user.findMany({ where: { orgId }, include: { role: true }, orderBy: { fullName: "asc" } });
  const roles = await prisma.role.findMany({ where: { orgId }, orderBy: { name: "asc" } });

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="text-2xl font-semibold text-neutral-900">إدارة الأدوار</h1>
      <p className="mt-1 text-sm text-neutral-500">
        تعيين دور لكل مستخدم — الصلاحيات الفعلية لكل دور مذكورة في `prisma/seed.ts` (`ROLE_GRANTS`).
      </p>

      <div className="mt-6">
        <CreateUserForm roles={roles.map((r) => ({ id: r.id, name: r.name }))} />
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-neutral-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-50 text-right text-xs uppercase tracking-wide text-neutral-500">
              <th className="px-4 py-3 font-medium">الاسم</th>
              <th className="px-4 py-3 font-medium">البريد</th>
              <th className="px-4 py-3 font-medium">الدور</th>
              <th className="px-4 py-3 font-medium">كلمة السر</th>
              <th className="px-4 py-3 font-medium">الحالة</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-neutral-100 last:border-0">
                <td className="px-4 py-3 font-medium text-neutral-900">{u.fullName}</td>
                <td className="px-4 py-3 text-neutral-600">{u.email}</td>
                <td className="px-4 py-3">
                  <RoleSelectForm
                    userId={u.id}
                    currentRoleId={u.roleId}
                    roles={roles.map((r) => ({ id: r.id, name: r.name }))}
                    isSelf={u.id === user.id}
                  />
                </td>
                <td className="px-4 py-3">
                  <ResetPasswordForm userId={u.id} />
                </td>
                <td className="px-4 py-3">
                  {u.id === user.id ? (
                    <span className="text-xs text-amber-600">ده حسابك</span>
                  ) : (
                    <ToggleActiveForm userId={u.id} isActive={u.isActive} />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
