import { requireCurrentUser } from "@/lib/session";
import { requirePermission } from "@/lib/permissions";
import { getScopedPrisma } from "@/lib/scoped-prisma";
import CostCenterForm from "./CostCenterForm";
import CostCenterEditControl from "./CostCenterEditControl";
import { costCenterTypeLabel } from "@/lib/accountingLabels";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PAGE_SIZE, parsePage } from "@/lib/pagination";
import Pagination from "@/components/Pagination";

export const dynamic = "force-dynamic";

export default async function CostCentersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const user = await requireCurrentUser();

  try {
    await requirePermission(user.roleId, "CostCenter", "View");
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
  const page = parsePage((await searchParams).page);
  const where = { orgId };
  const records = await prisma.costCenter.findMany({
    where,
    orderBy: { code: "asc" },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });
  const total = await prisma.costCenter.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">مراكز التكلفة</h1>
        <p className="mt-1 text-sm text-muted-foreground">{total} مركز مسجّل</p>
      </div>

      <div className="mt-6">
        <CostCenterForm />
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>الكود</TableHead>
              <TableHead>الاسم</TableHead>
              <TableHead>النوع</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-6 text-center text-muted-foreground">
                  لسه مفيش مراكز تكلفة مسجّلة.
                </TableCell>
              </TableRow>
            ) : (
              records.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-mono text-foreground">{c.code}</TableCell>
                  <TableCell className="text-foreground/80">{c.name}</TableCell>
                  <TableCell className="text-foreground/80">{costCenterTypeLabel[c.type]}</TableCell>
                  <TableCell>
                    <CostCenterEditControl costCenterId={c.id} name={c.name} type={c.type} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <Pagination currentPage={page} totalPages={totalPages} basePath="/accounting/cost-centers" />
    </main>
  );
}
