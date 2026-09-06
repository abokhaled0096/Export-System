import Link from "next/link";
import { requireCurrentUser } from "@/lib/session";
import { requirePermission } from "@/lib/permissions";
import { getScopedPrisma } from "@/lib/scoped-prisma";
import { PAGE_SIZE, parsePage } from "@/lib/pagination";
import Pagination from "@/components/Pagination";
import CAPAForm from "./CAPAForm";
import { capaRootCauseMethodLabel, capaStatusLabel, capaStatusStyle, isCAPAOverdue } from "@/lib/capaLabels";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const dynamic = "force-dynamic";

export default async function CAPAPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const user = await requireCurrentUser();

  try {
    await requirePermission(user.roleId, "CAPA", "View");
  } catch {
    return (
      <main className="mx-auto max-w-3xl px-6 py-10">
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-6 text-center text-sm text-destructive">
          معندكش صلاحية الوصول للصفحة دي — متاحة لـQualityManager/ComplianceOfficer/Admin/CompanyOwner.
        </div>
      </main>
    );
  }

  const page = parsePage((await searchParams).page);
  const orgId = user.orgId;
  const prisma = await getScopedPrisma();

  const records = await prisma.cAPA.findMany({
    where: { orgId },
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });
  const total = await prisma.cAPA.count({ where: { orgId } });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">الإجراءات التصحيحية والوقائية (CAPA)</h1>
        <p className="mt-1 text-sm text-muted-foreground">{total} إجراء مسجّل</p>
      </div>

      <div className="mt-6">
        <CAPAForm />
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>السبب الجذري</TableHead>
              <TableHead>طريقة التحليل</TableHead>
              <TableHead>الإجراء التصحيحي</TableHead>
              <TableHead>تاريخ الاستحقاق</TableHead>
              <TableHead>الحالة</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-6 text-center text-muted-foreground">
                  لسه مفيش إجراءات تصحيحية مسجّلة.
                </TableCell>
              </TableRow>
            ) : (
              records.map((c) => {
                const overdue = isCAPAOverdue(c.status, c.dueDate);
                return (
                  <TableRow key={c.id}>
                    <TableCell>
                      <Link href={`/capa/${c.id}`} className="text-primary hover:underline">
                        {c.rootCause ?? "إجراء بلا سبب مسجَّل"}
                      </Link>
                    </TableCell>
                    <TableCell className="text-foreground/80">{c.rootCauseMethod ? capaRootCauseMethodLabel[c.rootCauseMethod] : "—"}</TableCell>
                    <TableCell className="text-foreground/80">{c.correctiveAction ?? "—"}</TableCell>
                    <TableCell className="text-foreground/80">{c.dueDate ? c.dueDate.toLocaleDateString("ar-EG") : "—"}</TableCell>
                    <TableCell className="flex gap-1.5">
                      <Badge className={capaStatusStyle[c.status]}>{capaStatusLabel[c.status]}</Badge>
                      {overdue && <Badge className={capaStatusStyle.Overdue}>متأخر</Badge>}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
      <Pagination currentPage={page} totalPages={totalPages} basePath="/capa" extraParams={{}} />
    </main>
  );
}
