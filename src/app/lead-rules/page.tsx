import { requireCurrentUser } from "@/lib/session";
import { requirePermission } from "@/lib/permissions";
import { getScopedPrisma } from "@/lib/scoped-prisma";
import { PAGE_SIZE, parsePage } from "@/lib/pagination";
import Pagination from "@/components/Pagination";
import LeadAssignmentRuleForm from "./LeadAssignmentRuleForm";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const dynamic = "force-dynamic";

export default async function LeadRulesPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const user = await requireCurrentUser();

  try {
    await requirePermission(user.roleId, "LeadAssignmentRule", "View");
  } catch {
    return (
      <main className="mx-auto max-w-3xl px-6 py-10">
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-6 text-center text-sm text-destructive">
          معندكش صلاحية الوصول للصفحة دي.
        </div>
      </main>
    );
  }

  const page = parsePage((await searchParams).page);
  const orgId = user.orgId;
  const prisma = await getScopedPrisma();

  const records = await prisma.leadAssignmentRule.findMany({
    where: { orgId },
    include: { assignToUser: { select: { fullName: true } }, assignToTeam: { select: { name: true } } },
    orderBy: { priority: "desc" },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });
  const total = await prisma.leadAssignmentRule.count({ where: { orgId } });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // ⚠️ مش Promise.all — راجع BACKLOG.md (P2028).
  const users = await prisma.user.findMany({ where: { orgId }, select: { id: true, fullName: true }, orderBy: { fullName: "asc" } });
  const teams = await prisma.team.findMany({ where: { orgId }, select: { id: true, name: true }, orderBy: { name: "asc" } });

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">قواعد توزيع العملاء المحتملين</h1>
        <p className="mt-1 text-sm text-muted-foreground">{total} قاعدة مسجّلة</p>
        <p className="mt-1 text-xs text-muted-foreground">
          تسجيل قواعد بس — بلا محرك توزيع تلقائي فعلي يربطها بإنشاء فرصة جديدة لسه.
        </p>
      </div>

      <div className="mt-6">
        <LeadAssignmentRuleForm users={users} teams={teams} />
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>الأولوية</TableHead>
              <TableHead>يتعيّن لمستخدم</TableHead>
              <TableHead>يتعيّن لفريق</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="py-6 text-center text-muted-foreground">
                  لسه مفيش قواعد توزيع مسجّلة.
                </TableCell>
              </TableRow>
            ) : (
              records.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-foreground">{r.priority}</TableCell>
                  <TableCell className="text-foreground/80">{r.assignToUser?.fullName ?? "—"}</TableCell>
                  <TableCell className="text-foreground/80">{r.assignToTeam?.name ?? "—"}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <Pagination currentPage={page} totalPages={totalPages} basePath="/lead-rules" extraParams={{}} />
    </main>
  );
}
