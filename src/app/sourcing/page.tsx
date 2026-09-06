import Link from "next/link";
import { requireCurrentUser } from "@/lib/session";
import { requirePermission } from "@/lib/permissions";
import { getScopedPrisma } from "@/lib/scoped-prisma";
import { PAGE_SIZE, parsePage } from "@/lib/pagination";
import Pagination from "@/components/Pagination";
import { sourcingRequestStatusLabel, sourcingRequestStatusStyle } from "@/lib/procurementLabels";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Prisma } from "@/generated/prisma/client";
import type { SourcingRequestStatus } from "@/generated/prisma/enums";

export const dynamic = "force-dynamic";

const statuses = Object.keys(sourcingRequestStatusLabel);

export default async function SourcingPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; status?: string }>;
}) {
  const user = await requireCurrentUser();

  try {
    await requirePermission(user.roleId, "SourcingRequest", "View");
  } catch {
    return (
      <main className="mx-auto max-w-3xl px-6 py-10">
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-6 text-center text-sm text-destructive">
          معندكش صلاحية الوصول للصفحة دي — متاحة لـProcurementOfficer/Admin/CompanyOwner.
        </div>
      </main>
    );
  }

  const { status } = await searchParams;
  const page = parsePage((await searchParams).page);
  const orgId = user.orgId;
  const prisma = await getScopedPrisma();

  const where: Prisma.SourcingRequestWhereInput = {
    orgId,
    ...(status && statuses.includes(status) ? { status: status as SourcingRequestStatus } : {}),
  };

  // ⚠️ مش Promise.all — راجع BACKLOG.md (P2028).
  const requests = await prisma.sourcingRequest.findMany({
    where,
    include: { deal: { include: { customer: true } }, product: true },
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });
  const total = await prisma.sourcingRequest.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">طلبات التوريد</h1>
          <p className="mt-1 text-sm text-muted-foreground">{total} طلب — بتتفتح من صفحة سيناريو الصفقة المرتبطة.</p>
        </div>
        <Button nativeButton={false} variant="outline" size="sm" render={<Link href="/suppliers">الموردون</Link>} />
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <Button nativeButton={false} variant={!status ? "secondary" : "ghost"} size="sm" render={<Link href="/sourcing" />}>
          الكل
        </Button>
        {statuses.map((s) => (
          <Button
            key={s}
            nativeButton={false}
            variant={status === s ? "secondary" : "ghost"}
            size="sm"
            render={<Link href={`/sourcing?status=${s}`} />}
          >
            {sourcingRequestStatusLabel[s]}
          </Button>
        ))}
      </div>

      {requests.length === 0 ? (
        <div className="mt-10 rounded-xl border border-dashed border-border py-16 text-center text-muted-foreground">
          {status ? <p>مفيش طلبات مطابقة للفلتر ده.</p> : <p>لسه مفيش طلبات توريد — بتتفتح من صفحة سيناريو صفقة.</p>}
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>العميل</TableHead>
                <TableHead>المنتج</TableHead>
                <TableHead>الحد الأقصى للسعر</TableHead>
                <TableHead>الحالة</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <Button nativeButton={false} variant="link" className="h-auto p-0 font-medium" render={<Link href={`/sourcing/${r.id}`}>{r.deal.customer.legalName}</Link>} />
                  </TableCell>
                  <TableCell className="text-foreground/80">{r.product.nameAr}</TableCell>
                  <TableCell className="font-mono text-foreground/80">
                    {r.maximumPurchasePrice.toString()} {r.currency}
                  </TableCell>
                  <TableCell>
                    <Badge className={sourcingRequestStatusStyle[r.status]}>{sourcingRequestStatusLabel[r.status]}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <Pagination currentPage={page} totalPages={totalPages} basePath="/sourcing" extraParams={{ status }} />
    </main>
  );
}
