import { requireCurrentUser } from "@/lib/session";
import { requirePermission } from "@/lib/permissions";
import { getScopedPrisma } from "@/lib/scoped-prisma";
import { getCurrentOrgId } from "@/lib/org";
import DepartmentForm from "./DepartmentForm";
import TeamForm from "./TeamForm";
import TeamAssignForm from "./TeamAssignForm";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PAGE_SIZE, parsePage } from "@/lib/pagination";
import Pagination from "@/components/Pagination";

export const dynamic = "force-dynamic";

export default async function AdminTeamsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const user = await requireCurrentUser();

  try {
    await requirePermission(user.roleId, "User", "Edit");
  } catch {
    return (
      <main className="mx-auto max-w-3xl px-6 py-10">
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-6 text-center text-sm text-rose-700">
          معندكش صلاحية الوصول للصفحة دي — إدارة الفرق متاحة لـAdmin/CompanyOwner بس.
        </div>
      </main>
    );
  }

  const orgId = await getCurrentOrgId();
  const prisma = await getScopedPrisma();
  const page = parsePage((await searchParams).page);
  // ⚠️ مش Promise.all — راجع BACKLOG.md (P2028).
  const departments = await prisma.department.findMany({ where: { orgId }, orderBy: { name: "asc" } });
  const teams = await prisma.team.findMany({
    where: { orgId },
    include: { department: true, manager: true, _count: { select: { members: true } } },
    orderBy: { name: "asc" },
  });
  // allUsers: قايمة كاملة بلا صفحات — لازمة لـTeamForm (اختيار مدير الفريق) بلا نقص.
  const allUsers = await prisma.user.findMany({ where: { orgId }, orderBy: { fullName: "asc" } });
  // users: نفس القايمة لكن بصفحات — دي المعروضة في جدول "تعيين المستخدمين للفرق" تحت.
  const users = await prisma.user.findMany({
    where: { orgId },
    orderBy: { fullName: "asc" },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });
  const total = await prisma.user.count({ where: { orgId } });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const teamOptions = teams.map((t) => ({ id: t.id, label: t.name }));

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="text-2xl font-semibold text-foreground">إدارة الفرق</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        الأقسام والفرق بتتحكّم في نطاق &quot;Team&quot; للصلاحيات — راجع BACKLOG.md § خلصان (30 أغسطس).
      </p>

      <section className="mt-8">
        <h2 className="text-lg font-medium text-foreground">الأقسام</h2>
        <div className="mt-3">
          <DepartmentForm />
        </div>
        {departments.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {departments.map((d) => (
              <Badge key={d.id} variant="secondary">
                {d.name}
              </Badge>
            ))}
          </div>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-medium text-foreground">الفرق</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {departments.length === 0
            ? "محتاج تعمل قسم الأول قبل ما تقدر تنشئ فريق."
            : `${teams.length} فريق مسجّل`}
        </p>
        {departments.length > 0 && (
          <div className="mt-3">
            {/* key بيتغيّر لو قايمة الأقسام اتغيّرت (قسم جديد اتضاف) — نفس سبب الـkey في
                TeamAssignForm تحت: يمنع تحذير Base UI عن defaultValue بيتغيّر على Select
                غير متحكَّم فيه بعد أول render. */}
            <TeamForm
              key={departments.map((d) => d.id).join(",")}
              departments={departments.map((d) => ({ id: d.id, label: d.name }))}
              users={allUsers.map((u) => ({ id: u.id, label: u.fullName }))}
            />
          </div>
        )}

        {teams.length > 0 && (
          <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الفريق</TableHead>
                  <TableHead>القسم</TableHead>
                  <TableHead>المدير</TableHead>
                  <TableHead>عدد الأعضاء</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teams.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium text-foreground">{t.name}</TableCell>
                    <TableCell className="text-foreground/80">{t.department.name}</TableCell>
                    <TableCell className="text-foreground/80">{t.manager?.fullName ?? "—"}</TableCell>
                    <TableCell className="font-mono text-foreground/80">{t._count.members}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-medium text-foreground">تعيين المستخدمين للفرق</h2>
        {teams.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">محتاج تعمل فريق الأول.</p>
        ) : (
          <>
            <div className="mt-3 overflow-x-auto rounded-xl border border-border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>الاسم</TableHead>
                    <TableHead>البريد</TableHead>
                    <TableHead>الفريق</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium text-foreground">{u.fullName}</TableCell>
                      <TableCell className="text-foreground/80">{u.email}</TableCell>
                      <TableCell>
                        {/* key فيه teamId عمدًا — بعد الحفظ الناجح والـrevalidate، currentTeamId بيتغيّر
                            على نفس نسخة المكوّن (نفس u.id)، وBase UI بيحذّر لو defaultValue اتغيّر
                            على Select غير متحكَّم فيه بعد أول render. الـkey ده بيجبر React يعمل remount
                            نضيف بدل ما يمرّر defaultValue جديدة لنفس النسخة. */}
                        <TeamAssignForm
                          key={`${u.id}:${u.teamId ?? "none"}`}
                          userId={u.id}
                          currentTeamId={u.teamId}
                          teams={teamOptions}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <Pagination currentPage={page} totalPages={totalPages} basePath="/admin/teams" extraParams={{}} />
          </>
        )}
      </section>
    </main>
  );
}
