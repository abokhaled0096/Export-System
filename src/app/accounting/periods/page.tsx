import { requireCurrentUser } from "@/lib/session";
import { requirePermission } from "@/lib/permissions";
import { getScopedPrisma } from "@/lib/scoped-prisma";
import AccountingPeriodForm from "./AccountingPeriodForm";
import ClosePeriodButton from "./ClosePeriodButton";
import { accountingPeriodStatusLabel, accountingPeriodStatusStyle } from "@/lib/accountingLabels";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PAGE_SIZE, parsePage } from "@/lib/pagination";
import Pagination from "@/components/Pagination";

export const dynamic = "force-dynamic";

export default async function AccountingPeriodsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const user = await requireCurrentUser();

  try {
    await requirePermission(user.roleId, "AccountingPeriod", "View");
  } catch {
    return (
      <main className="mx-auto max-w-3xl px-6 py-10">
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-6 text-center text-sm text-destructive">
          معندكش صلاحية الوصول للصفحة دي — متاحة لدور Finance/Admin/CompanyOwner.
        </div>
      </main>
    );
  }

  const orgId = user.orgId;
  const prisma = await getScopedPrisma();
  const page = parsePage((await searchParams).page);
  const where = { orgId };

  const periods = await prisma.accountingPeriod.findMany({
    where,
    include: { closedByUser: { select: { fullName: true } } },
    orderBy: { startDate: "desc" },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });
  const total = await prisma.accountingPeriod.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">الفترات المحاسبية</h1>
        <p className="mt-1 text-sm text-muted-foreground">{total} فترة مسجّلة</p>
      </div>

      <div className="mt-6">
        <AccountingPeriodForm />
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>الفترة</TableHead>
              <TableHead>البداية</TableHead>
              <TableHead>النهاية</TableHead>
              <TableHead>الحالة</TableHead>
              <TableHead>قُفلت بمعرفة</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {periods.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-6 text-center text-muted-foreground">
                  لسه مفيش فترات مسجّلة.
                </TableCell>
              </TableRow>
            ) : (
              periods.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-mono text-foreground">{p.periodName}</TableCell>
                  <TableCell className="text-foreground/80">{p.startDate.toLocaleDateString("ar-EG")}</TableCell>
                  <TableCell className="text-foreground/80">{p.endDate.toLocaleDateString("ar-EG")}</TableCell>
                  <TableCell>
                    <Badge className={accountingPeriodStatusStyle[p.status]}>{accountingPeriodStatusLabel[p.status]}</Badge>
                  </TableCell>
                  <TableCell className="text-foreground/80">{p.closedByUser?.fullName ?? "—"}</TableCell>
                  <TableCell>
                    <ClosePeriodButton periodId={p.id} status={p.status} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <Pagination currentPage={page} totalPages={totalPages} basePath="/accounting/periods" />
    </main>
  );
}
