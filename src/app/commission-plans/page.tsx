import { requireCurrentUser } from "@/lib/session";
import { requirePermission } from "@/lib/permissions";
import { getScopedPrisma } from "@/lib/scoped-prisma";
import { PAGE_SIZE, parsePage } from "@/lib/pagination";
import Pagination from "@/components/Pagination";
import CommissionPlanForm from "./CommissionPlanForm";
import { commissionBasisLabel, commissionTriggerEventLabel } from "@/lib/commissionLabels";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const dynamic = "force-dynamic";

export default async function CommissionPlansPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const user = await requireCurrentUser();

  try {
    await requirePermission(user.roleId, "CommissionPlan", "View");
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

  const records = await prisma.commissionPlan.findMany({
    where: { orgId },
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });
  const total = await prisma.commissionPlan.count({ where: { orgId } });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">خطط العمولة</h1>
        <p className="mt-1 text-sm text-muted-foreground">{total} خطة مسجّلة</p>
      </div>

      <div className="mt-6">
        <CommissionPlanForm />
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>الاسم</TableHead>
              <TableHead>الأساس</TableHead>
              <TableHead>النسبة % / الشرايح</TableHead>
              <TableHead>يُستحق عند</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-6 text-center text-muted-foreground">
                  لسه مفيش خطط عمولة مسجّلة.
                </TableCell>
              </TableRow>
            ) : (
              records.map((p) => {
                const tiers = Array.isArray(p.tiers) ? (p.tiers as { minAmount: number; maxAmount?: number; ratePct: number }[]) : null;
                return (
                  <TableRow key={p.id}>
                    <TableCell className="text-foreground">{p.name}</TableCell>
                    <TableCell className="text-foreground/80">{commissionBasisLabel[p.basis]}</TableCell>
                    <TableCell className="font-mono text-xs text-foreground/80">
                      {tiers && tiers.length > 0
                        ? tiers.map((t, i) => (
                            <div key={i}>
                              {t.minAmount}–{t.maxAmount ?? "∞"}: {t.ratePct}%
                            </div>
                          ))
                        : (p.ratePct?.toString() ?? "—")}
                    </TableCell>
                    <TableCell className="text-foreground/80">{commissionTriggerEventLabel[p.triggerEvent]}</TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
      <Pagination currentPage={page} totalPages={totalPages} basePath="/commission-plans" extraParams={{}} />
    </main>
  );
}
