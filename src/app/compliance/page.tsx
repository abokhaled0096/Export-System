import Link from "next/link";
import { requireCurrentUser } from "@/lib/session";
import { requirePermission } from "@/lib/permissions";
import { getScopedPrisma } from "@/lib/scoped-prisma";
import { PAGE_SIZE, parsePage } from "@/lib/pagination";
import Pagination from "@/components/Pagination";
import {
  complianceCaseStatusLabel,
  complianceCaseStatusStyle,
  operationTypeLabel,
} from "@/lib/complianceLabels";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Prisma } from "@/generated/prisma/client";
import type { ComplianceCaseStatus } from "@/generated/prisma/enums";

export const dynamic = "force-dynamic";

const statuses = Object.keys(complianceCaseStatusLabel);

export default async function CompliancePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; status?: string }>;
}) {
  const user = await requireCurrentUser();

  try {
    await requirePermission(user.roleId, "ComplianceCase", "View");
  } catch {
    return (
      <main className="mx-auto max-w-3xl px-6 py-10">
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-6 text-center text-sm text-destructive">
          معندكش صلاحية الوصول للصفحة دي — الامتثال والجمارك متاحة لـComplianceOfficer/SalesManager/Admin/CompanyOwner.
        </div>
      </main>
    );
  }

  const { status } = await searchParams;
  const page = parsePage((await searchParams).page);
  const orgId = user.orgId;
  const prisma = await getScopedPrisma();

  const where: Prisma.ComplianceCaseWhereInput = {
    orgId,
    deletedAt: null,
    ...(status && statuses.includes(status) ? { status: status as ComplianceCaseStatus } : {}),
  };

  // ⚠️ مش Promise.all — راجع BACKLOG.md (P2028).
  const cases = await prisma.complianceCase.findMany({
    where,
    include: { deal: { include: { customer: true } }, product: true, market: true, gates: true },
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });
  const total = await prisma.complianceCase.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">الامتثال والجمارك</h1>
          <p className="mt-1 text-sm text-muted-foreground">{total} ملف امتثال</p>
        </div>
        <Button nativeButton={false} variant="outline" render={<Link href="/compliance/requirements">بحث متطلبات مبكر</Link>} />
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <Button nativeButton={false} variant={!status ? "secondary" : "ghost"} size="sm" render={<Link href="/compliance" />}>
          الكل
        </Button>
        {statuses.map((s) => (
          <Button
            key={s}
            nativeButton={false}
            variant={status === s ? "secondary" : "ghost"}
            size="sm"
            render={<Link href={`/compliance?status=${s}`} />}
          >
            {complianceCaseStatusLabel[s]}
          </Button>
        ))}
      </div>

      {cases.length === 0 ? (
        <div className="mt-10 rounded-xl border border-dashed border-border py-16 text-center text-muted-foreground">
          {status ? (
            <p>مفيش ملفات امتثال مطابقة للفلتر ده.</p>
          ) : (
            <p>لسه مفيش ملفات امتثال — بتتفتح من صفحة سيناريو صفقة معتمد.</p>
          )}
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>العميل</TableHead>
                <TableHead>المنتج</TableHead>
                <TableHead>السوق</TableHead>
                <TableHead>نوع العملية</TableHead>
                <TableHead>البوابات</TableHead>
                <TableHead>الحالة</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cases.map((c) => {
                const passedGates = c.gates.filter((g) => g.status === "Passed" || g.status === "PassedWithConditions" || g.status === "Waived").length;
                return (
                  <TableRow key={c.id}>
                    <TableCell>
                      <Button nativeButton={false} variant="link" className="h-auto p-0 font-medium" render={<Link href={`/compliance/${c.id}`}>{c.deal.customer.legalName}</Link>} />
                    </TableCell>
                    <TableCell className="text-foreground/80">{c.product.nameAr}</TableCell>
                    <TableCell className="text-foreground/80">{c.market.countryNameAr}</TableCell>
                    <TableCell className="text-foreground/80">{operationTypeLabel[c.operationType]}</TableCell>
                    <TableCell className="font-mono text-foreground/80">
                      {c.gates.length > 0 ? `${passedGates}/${c.gates.length}` : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge className={complianceCaseStatusStyle[c.status]}>{complianceCaseStatusLabel[c.status]}</Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
      <Pagination currentPage={page} totalPages={totalPages} basePath="/compliance" extraParams={{ status }} />
    </main>
  );
}
