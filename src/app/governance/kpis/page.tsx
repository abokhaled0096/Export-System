import { requireCurrentUser } from "@/lib/session";
import { requirePermission } from "@/lib/permissions";
import { getScopedPrisma } from "@/lib/scoped-prisma";
import KpiForm, { type UserOption, type PeriodOption } from "./KpiForm";
import KpiEditControl from "./KpiEditControl";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const dynamic = "force-dynamic";

export default async function KpisPage() {
  const user = await requireCurrentUser();

  try {
    await requirePermission(user.roleId, "KPI", "View");
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
  const kpis = await prisma.kPI.findMany({
    where: { orgId },
    orderBy: { createdAt: "desc" },
    include: { owner: { select: { fullName: true } }, period: { select: { periodName: true } } },
  });
  const periods = await prisma.accountingPeriod.findMany({ where: { orgId }, orderBy: { startDate: "desc" }, select: { id: true, periodName: true } });
  const users = await prisma.user.findMany({ where: { orgId }, select: { id: true, fullName: true }, orderBy: { fullName: "asc" } });

  const periodOptions: PeriodOption[] = periods.map((p) => ({ id: p.id, label: p.periodName }));
  const userOptions: UserOption[] = users.map((u) => ({ id: u.id, label: u.fullName }));

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">مؤشرات الأداء</h1>
        <p className="mt-1 text-sm text-muted-foreground">{kpis.length} مؤشر</p>
      </div>

      <div className="mt-6">
        <KpiForm users={userOptions} periods={periodOptions} currentUserId={user.id} />
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>الاسم</TableHead>
              <TableHead>الفئة</TableHead>
              <TableHead>الفترة</TableHead>
              <TableHead>المسؤول</TableHead>
              <TableHead>المستهدف</TableHead>
              <TableHead>الفعلي</TableHead>
              <TableHead>الإنجاز</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {kpis.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-6 text-center text-muted-foreground">
                  لسه مفيش مؤشرات مسجّلة.
                </TableCell>
              </TableRow>
            ) : (
              kpis.map((k) => {
                const achievement = k.actualValue && !k.targetValue.isZero() ? k.actualValue.div(k.targetValue).mul(100) : null;
                const onTrack = achievement !== null && achievement.gte(100);
                return (
                  <TableRow key={k.id}>
                    <TableCell className="text-foreground">{k.name}</TableCell>
                    <TableCell className="text-foreground/80">{k.category}</TableCell>
                    <TableCell className="text-foreground/80">{k.period.periodName}</TableCell>
                    <TableCell className="text-foreground/80">{k.owner.fullName}</TableCell>
                    <TableCell className="font-mono text-foreground/80">{k.targetValue.toFixed(2)}</TableCell>
                    <TableCell className="font-mono text-foreground/80">{k.actualValue?.toFixed(2) ?? "—"}</TableCell>
                    <TableCell className={`font-mono font-semibold ${achievement === null ? "text-muted-foreground" : onTrack ? "text-emerald-700" : "text-amber-700"}`}>
                      {achievement === null ? "—" : `${achievement.toFixed(0)}%`}
                    </TableCell>
                    <TableCell>
                      <KpiEditControl
                        kpiId={k.id}
                        name={k.name}
                        category={k.category}
                        targetValue={k.targetValue.toFixed(2)}
                        actualValue={k.actualValue?.toFixed(2) ?? null}
                      />
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </main>
  );
}
