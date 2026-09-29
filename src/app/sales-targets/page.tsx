import { requireCurrentUser } from "@/lib/session";
import { requirePermission } from "@/lib/permissions";
import { getScopedPrisma } from "@/lib/scoped-prisma";
import { PAGE_SIZE, parsePage } from "@/lib/pagination";
import Pagination from "@/components/Pagination";
import SalesTargetForm from "./SalesTargetForm";
import RecomputeActualButton from "./RecomputeActualButton";
import { salesTargetTypeLabel } from "@/lib/salesTargetLabels";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import FormDialog from "@/components/FormDialog";

export const dynamic = "force-dynamic";

export default async function SalesTargetsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const user = await requireCurrentUser();

  try {
    await requirePermission(user.roleId, "SalesTarget", "View");
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

  const records = await prisma.salesTarget.findMany({
    where: { orgId },
    include: { user: { select: { fullName: true } }, team: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });
  const total = await prisma.salesTarget.count({ where: { orgId } });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // ⚠️ مش Promise.all — راجع BACKLOG.md (P2028).
  const users = await prisma.user.findMany({ where: { orgId }, select: { id: true, fullName: true }, orderBy: { fullName: "asc" } });
  const teams = await prisma.team.findMany({ where: { orgId }, select: { id: true, name: true }, orderBy: { name: "asc" } });

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">أهداف المبيعات</h1>
        <p className="mt-1 text-sm text-muted-foreground">{total} هدف مسجّل</p>
      </div>

      <div className="mt-6 flex justify-start">
        <FormDialog triggerLabel="+ هدف مبيعات" title="هدف مبيعات جديد">
          <SalesTargetForm users={users} teams={teams} />
        </FormDialog>
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>المستخدم/الفريق</TableHead>
              <TableHead>الفترة</TableHead>
              <TableHead>النوع</TableHead>
              <TableHead>القيمة المستهدفة</TableHead>
              <TableHead>القيمة الفعلية</TableHead>
              <TableHead>الإنجاز</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-6 text-center text-muted-foreground">
                  لسه مفيش أهداف مسجّلة.
                </TableCell>
              </TableRow>
            ) : (
              records.map((t) => {
                const canCompute = !!t.periodStart && !!t.periodEnd && (t.targetType === "DealsCount" || t.targetType === "Volume" || !!t.currency);
                const achievementPct = t.actualValue && t.targetValue.gt(0) ? t.actualValue.div(t.targetValue).mul(100).toFixed(0) : null;
                return (
                  <TableRow key={t.id}>
                    <TableCell className="text-foreground">{t.user?.fullName ?? t.team?.name ?? "—"}</TableCell>
                    <TableCell className="text-foreground/80">{t.period}</TableCell>
                    <TableCell className="text-foreground/80">{salesTargetTypeLabel[t.targetType]}</TableCell>
                    <TableCell className="font-mono text-foreground/80">
                      {t.targetValue.toString()} {t.targetType === "Revenue" ? (t.currency ?? "") : ""}
                    </TableCell>
                    <TableCell className="font-mono text-foreground/80">
                      {t.actualValue !== null ? `${t.actualValue.toString()} ${t.targetType === "Revenue" ? (t.currency ?? "") : ""}` : canCompute ? "—" : "غير قابل للحساب"}
                    </TableCell>
                    <TableCell className={`font-mono ${achievementPct && Number(achievementPct) >= 100 ? "text-emerald-700" : "text-foreground/80"}`}>
                      {achievementPct ? `${achievementPct}%` : "—"}
                    </TableCell>
                    <TableCell>{canCompute && <RecomputeActualButton targetId={t.id} />}</TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
      <Pagination currentPage={page} totalPages={totalPages} basePath="/sales-targets" extraParams={{}} />
    </main>
  );
}
