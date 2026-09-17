import { requireCurrentUser } from "@/lib/session";
import { requirePermission } from "@/lib/permissions";
import { getScopedPrisma } from "@/lib/scoped-prisma";
import ProfitCenterForm from "./ProfitCenterForm";
import ProfitCenterEditControl from "./ProfitCenterEditControl";
import { profitCenterScopeLabel } from "@/lib/accountingLabels";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const dynamic = "force-dynamic";

export default async function ProfitCentersPage() {
  const user = await requireCurrentUser();

  try {
    await requirePermission(user.roleId, "ProfitCenter", "View");
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
  const records = await prisma.profitCenter.findMany({ where: { orgId }, orderBy: { code: "asc" } });

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">مراكز الربحية</h1>
        <p className="mt-1 text-sm text-muted-foreground">{records.length} مركز مسجّل</p>
      </div>

      <div className="mt-6">
        <ProfitCenterForm />
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>الكود</TableHead>
              <TableHead>الاسم</TableHead>
              <TableHead>النطاق</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-6 text-center text-muted-foreground">
                  لسه مفيش مراكز ربحية مسجّلة.
                </TableCell>
              </TableRow>
            ) : (
              records.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-mono text-foreground">{p.code}</TableCell>
                  <TableCell className="text-foreground/80">{p.name}</TableCell>
                  <TableCell className="text-foreground/80">{profitCenterScopeLabel[p.scope]}</TableCell>
                  <TableCell>
                    <ProfitCenterEditControl profitCenterId={p.id} name={p.name} scope={p.scope} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </main>
  );
}
