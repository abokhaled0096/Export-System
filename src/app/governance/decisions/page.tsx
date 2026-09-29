import { requireCurrentUser } from "@/lib/session";
import { requirePermission } from "@/lib/permissions";
import { getScopedPrisma } from "@/lib/scoped-prisma";
import DecisionForm, { type UserOption } from "./DecisionForm";
import DecisionEditControl from "./DecisionEditControl";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PAGE_SIZE, parsePage } from "@/lib/pagination";
import Pagination from "@/components/Pagination";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function DecisionsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const page = parsePage((await searchParams).page);
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
  const decisionWhere = { orgId };
  const decisions = await prisma.decisionLogEntry.findMany({
    where: decisionWhere,
    orderBy: { decisionDate: "desc" },
    include: { decidedByUser: { select: { fullName: true } } },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });
  const total = await prisma.decisionLogEntry.count({ where: decisionWhere });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const users = await prisma.user.findMany({ where: { orgId }, select: { id: true, fullName: true }, orderBy: { fullName: "asc" } });
  const userOptions: UserOption[] = users.map((u) => ({ id: u.id, label: u.fullName }));

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">سجل القرارات</h1>
        <p className="mt-1 text-sm text-muted-foreground">{total} قرار مسجّل</p>
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
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {decisions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-6 text-center text-muted-foreground">
                  لسه مفيش قرارات مسجّلة.
                </TableCell>
              </TableRow>
            ) : (
              decisions.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="text-foreground/80">{formatDate(d.decisionDate)}</TableCell>
                  <TableCell className="text-foreground">{d.title}</TableCell>
                  <TableCell className="text-foreground/80">{d.decidedByUser.fullName}</TableCell>
                  <TableCell className="text-foreground/80">{d.context ?? "—"}</TableCell>
                  <TableCell className="text-foreground/80">{d.outcome ?? "—"}</TableCell>
                  <TableCell>
                    <DecisionEditControl entryId={d.id} title={d.title} context={d.context} outcome={d.outcome} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <Pagination currentPage={page} totalPages={totalPages} basePath="/governance/decisions" />
    </main>
  );
}
