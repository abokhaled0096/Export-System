import Link from "next/link";
import { requireCurrentUser } from "@/lib/session";
import { requirePermission } from "@/lib/permissions";
import { getScopedPrisma } from "@/lib/scoped-prisma";
import { PAGE_SIZE, parsePage } from "@/lib/pagination";
import Pagination from "@/components/Pagination";
import { shipmentStatusLabel, shipmentStatusStyle, transportModeLabel, aciStatusLabel, aciStatusStyle } from "@/lib/logisticsLabels";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Prisma } from "@/generated/prisma/client";
import type { ShipmentStatus } from "@/generated/prisma/enums";

export const dynamic = "force-dynamic";

const statuses = Object.keys(shipmentStatusLabel);

export default async function LogisticsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; status?: string }>;
}) {
  const user = await requireCurrentUser();

  try {
    await requirePermission(user.roleId, "Shipment", "View");
  } catch {
    return (
      <main className="mx-auto max-w-3xl px-6 py-10">
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-6 text-center text-sm text-destructive">
          معندكش صلاحية الوصول للصفحة دي — اللوجستيات متاحة لـLogisticsOfficer/Admin/CompanyOwner.
        </div>
      </main>
    );
  }

  const { status } = await searchParams;
  const page = parsePage((await searchParams).page);
  const orgId = user.orgId;
  const prisma = await getScopedPrisma();

  const where: Prisma.ShipmentWhereInput = {
    orgId,
    deletedAt: null,
    ...(status && statuses.includes(status) ? { status: status as ShipmentStatus } : {}),
  };

  // ⚠️ مش Promise.all — راجع BACKLOG.md (P2028).
  const shipments = await prisma.shipment.findMany({
    where,
    include: {
      deal: { include: { customer: true } },
      product: true,
      exceptions: {
        where: { status: { in: ["Open", "InProgress"] }, severity: { in: ["High", "Critical"] } },
        select: { id: true },
      },
      temperatureLogs: { where: { isExcursion: true }, select: { id: true } },
    },
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });
  const total = await prisma.shipment.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">اللوجستيات</h1>
          <p className="mt-1 text-sm text-muted-foreground">{total} شحنة — الشحنات بتتفتح من صفحة ملف الامتثال المرتبط.</p>
        </div>
        <div className="flex gap-2">
          <Button nativeButton={false} variant="outline" size="sm" render={<Link href="/logistics/providers">مزوّدو الخدمة</Link>} />
          <Button nativeButton={false} variant="outline" size="sm" render={<Link href="/logistics/routes">خطوط الشحن</Link>} />
          <Button nativeButton={false} variant="outline" size="sm" render={<Link href="/logistics/quotes">عروض الأسعار</Link>} />
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <Button nativeButton={false} variant={!status ? "secondary" : "ghost"} size="sm" render={<Link href="/logistics" />}>
          الكل
        </Button>
        {statuses.map((s) => (
          <Button
            key={s}
            nativeButton={false}
            variant={status === s ? "secondary" : "ghost"}
            size="sm"
            render={<Link href={`/logistics?status=${s}`} />}
          >
            {shipmentStatusLabel[s]}
          </Button>
        ))}
      </div>

      {shipments.length === 0 ? (
        <div className="mt-10 rounded-xl border border-dashed border-border py-16 text-center text-muted-foreground">
          {status ? <p>مفيش شحنات مطابقة للفلتر ده.</p> : <p>لسه مفيش شحنات — بتتفتح من صفحة ملف الامتثال.</p>}
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>العميل</TableHead>
                <TableHead>المنتج</TableHead>
                <TableHead>وسيلة النقل</TableHead>
                <TableHead>الميناءين</TableHead>
                <TableHead>ACI</TableHead>
                <TableHead>تنبيهات</TableHead>
                <TableHead>الحالة</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shipments.map((s) => {
                const hasCriticalException = s.exceptions.length > 0;
                const hasExcursion = s.temperatureLogs.length > 0;
                return (
                  <TableRow key={s.id}>
                    <TableCell>
                      <Button nativeButton={false} variant="link" className="h-auto p-0 font-medium" render={<Link href={`/logistics/${s.id}`}>{s.deal.customer.legalName}</Link>} />
                    </TableCell>
                    <TableCell className="text-foreground/80">{s.product.nameAr}</TableCell>
                    <TableCell className="text-foreground/80">{transportModeLabel[s.transportMode]}</TableCell>
                    <TableCell className="text-foreground/80">
                      {s.originPort} ← {s.destinationPort}
                    </TableCell>
                    <TableCell>
                      <Badge className={aciStatusStyle[s.aciStatus]}>{aciStatusLabel[s.aciStatus]}</Badge>
                      {s.aciStatus !== "NotRequired" && (
                        <span className={`ms-1 text-xs ${s.aciDeadlineMet ? "text-emerald-700" : "text-rose-700"}`}>
                          {s.aciDeadlineMet ? "المهلة مستوفاة" : "المهلة غير مستوفاة"}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {hasCriticalException || hasExcursion ? (
                        <div className="flex flex-wrap gap-1">
                          {hasCriticalException && <Badge className="bg-rose-100 text-rose-700 hover:bg-rose-100">استثناء حرج</Badge>}
                          {hasExcursion && <Badge className="bg-rose-100 text-rose-700 hover:bg-rose-100">تجاوز حراري</Badge>}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className={shipmentStatusStyle[s.status]}>{shipmentStatusLabel[s.status]}</Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
      <Pagination currentPage={page} totalPages={totalPages} basePath="/logistics" extraParams={{ status }} />
    </main>
  );
}
