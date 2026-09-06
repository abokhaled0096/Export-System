import { requireCurrentUser } from "@/lib/session";
import { requirePermission } from "@/lib/permissions";
import { getScopedPrisma } from "@/lib/scoped-prisma";
import { PAGE_SIZE, parsePage } from "@/lib/pagination";
import Pagination from "@/components/Pagination";
import ClauseForm from "./ClauseForm";
import { clauseCategoryLabel, clauseRiskLevelLabel, clauseRiskLevelStyle } from "@/lib/clauseLabels";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const dynamic = "force-dynamic";

export default async function ClausesPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const user = await requireCurrentUser();

  try {
    await requirePermission(user.roleId, "Clause", "View");
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

  const records = await prisma.clause.findMany({
    where: { orgId },
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });
  const total = await prisma.clause.count({ where: { orgId } });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">مكتبة البنود التعاقدية</h1>
        <p className="mt-1 text-sm text-muted-foreground">{total} بند مسجّل</p>
      </div>

      <div className="mt-6">
        <ClauseForm />
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>العنوان</TableHead>
              <TableHead>الفئة</TableHead>
              <TableHead>الخطورة</TableHead>
              <TableHead>يحتاج موافقة</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-6 text-center text-muted-foreground">
                  لسه مفيش بنود مسجّلة.
                </TableCell>
              </TableRow>
            ) : (
              records.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="text-foreground">{c.title}</TableCell>
                  <TableCell className="text-foreground/80">{clauseCategoryLabel[c.category]}</TableCell>
                  <TableCell>
                    <Badge className={clauseRiskLevelStyle[c.riskLevel]}>{clauseRiskLevelLabel[c.riskLevel]}</Badge>
                  </TableCell>
                  <TableCell className="text-foreground/80">{c.approvalRequired ? "نعم" : "لا"}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <Pagination currentPage={page} totalPages={totalPages} basePath="/clauses" extraParams={{}} />
    </main>
  );
}
