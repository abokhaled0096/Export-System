import { requireCurrentUser } from "@/lib/session";
import { requirePermission } from "@/lib/permissions";
import { getScopedPrisma } from "@/lib/scoped-prisma";
import DecisionForm, { type UserOption } from "./DecisionForm";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const dynamic = "force-dynamic";

export default async function DecisionsPage() {
  const user = await requireCurrentUser();

  try {
    await requirePermission(user.roleId, "DecisionLogEntry", "View");
  } catch {
    return (
      <main className="mx-auto max-w-3xl px-6 py-10">
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-6 text-center text-sm text-destructive">
          معندكش صلاحية الوصول للصفحة دي.
        </div>
      </main>
    );
  }

  const orgId = user.orgId;
  const prisma = await getScopedPrisma();

  // ⚠️ مش Promise.all — راجع BACKLOG.md (P2028).
  const decisions = await prisma.decisionLogEntry.findMany({
    where: { orgId },
    orderBy: { decisionDate: "desc" },
    include: { decidedByUser: { select: { fullName: true } } },
  });
  const users = await prisma.user.findMany({ where: { orgId }, select: { id: true, fullName: true }, orderBy: { fullName: "asc" } });
  const userOptions: UserOption[] = users.map((u) => ({ id: u.id, label: u.fullName }));

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">سجل القرارات</h1>
        <p className="mt-1 text-sm text-muted-foreground">{decisions.length} قرار مسجّل</p>
      </div>

      <div className="mt-6">
        <DecisionForm users={userOptions} currentUserId={user.id} />
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>التاريخ</TableHead>
              <TableHead>العنوان</TableHead>
              <TableHead>اتخذه</TableHead>
              <TableHead>السياق</TableHead>
              <TableHead>النتيجة</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {decisions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-6 text-center text-muted-foreground">
                  لسه مفيش قرارات مسجّلة.
                </TableCell>
              </TableRow>
            ) : (
              decisions.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="text-foreground/80">{d.decisionDate.toISOString().slice(0, 10)}</TableCell>
                  <TableCell className="text-foreground">{d.title}</TableCell>
                  <TableCell className="text-foreground/80">{d.decidedByUser.fullName}</TableCell>
                  <TableCell className="text-foreground/80">{d.context ?? "—"}</TableCell>
                  <TableCell className="text-foreground/80">{d.outcome ?? "—"}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </main>
  );
}
