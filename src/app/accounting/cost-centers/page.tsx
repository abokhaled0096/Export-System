import { requireCurrentUser } from "@/lib/session";
import { requirePermission } from "@/lib/permissions";
import { getScopedPrisma } from "@/lib/scoped-prisma";
import CostCenterForm from "./CostCenterForm";
import { costCenterTypeLabel } from "@/lib/accountingLabels";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const dynamic = "force-dynamic";

export default async function CostCentersPage() {
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
  const records = await prisma.costCenter.findMany({ where: { orgId }, orderBy: { code: "asc" } });

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">مراكز التكلفة</h1>
        <p className="mt-1 text-sm text-muted-foreground">{records.length} مركز مسجّل</p>
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
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="py-6 text-center text-muted-foreground">
                  لسه مفيش مراكز تكلفة مسجّلة.
                </TableCell>
              </TableRow>
            ) : (
              records.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-mono text-foreground">{c.code}</TableCell>
                  <TableCell className="text-foreground/80">{c.name}</TableCell>
                  <TableCell className="text-foreground/80">{costCenterTypeLabel[c.type]}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </main>
  );
}
