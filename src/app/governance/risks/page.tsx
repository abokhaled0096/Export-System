import { requireCurrentUser } from "@/lib/session";
import { requirePermission } from "@/lib/permissions";
import { getScopedPrisma } from "@/lib/scoped-prisma";
import RiskForm, { type UserOption } from "./RiskForm";
import StatusButtons from "./StatusButtons";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = { Open: "مفتوح", Mitigated: "مخفَّف", Closed: "مُقفَل" };
const STATUS_STYLE: Record<string, string> = {
  Open: "bg-rose-100 text-rose-700 hover:bg-rose-100",
  Mitigated: "bg-amber-100 text-amber-700 hover:bg-amber-100",
  Closed: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
};

export default async function RisksPage() {
  const user = await requireCurrentUser();

  try {
    await requirePermission(user.roleId, "RiskRegisterItem", "View");
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
  const risks = await prisma.riskRegisterItem.findMany({
    where: { orgId },
    orderBy: [{ status: "asc" }, { financialImpact: "desc" }],
    include: { owner: { select: { fullName: true } } },
  });
  const users = await prisma.user.findMany({ where: { orgId }, select: { id: true, fullName: true }, orderBy: { fullName: "asc" } });

  const userOptions: UserOption[] = users.map((u) => ({ id: u.id, label: u.fullName }));

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">سجل المخاطر</h1>
        <p className="mt-1 text-sm text-muted-foreground">{risks.length} خطر مسجّل</p>
      </div>

      <div className="mt-6">
        <RiskForm users={userOptions} currentUserId={user.id} />
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>العنوان</TableHead>
              <TableHead>الفئة</TableHead>
              <TableHead>الاحتمالية</TableHead>
              <TableHead>الأثر المالي</TableHead>
              <TableHead>المسؤول</TableHead>
              <TableHead>الحالة</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {risks.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-6 text-center text-muted-foreground">
                  لسه مفيش مخاطر مسجّلة.
                </TableCell>
              </TableRow>
            ) : (
              risks.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-foreground">{r.title}</TableCell>
                  <TableCell className="text-foreground/80">{r.category}</TableCell>
                  <TableCell className="font-mono text-foreground/80">{r.probability}%</TableCell>
                  <TableCell className="font-mono text-foreground/80">
                    {r.financialImpact.toFixed(2)} {r.currency}
                  </TableCell>
                  <TableCell className="text-foreground/80">{r.owner.fullName}</TableCell>
                  <TableCell>
                    <Badge className={STATUS_STYLE[r.status]}>{STATUS_LABEL[r.status]}</Badge>
                  </TableCell>
                  <TableCell>
                    <StatusButtons riskId={r.id} status={r.status} />
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
