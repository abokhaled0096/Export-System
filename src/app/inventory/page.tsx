import { requireCurrentUser } from "@/lib/session";
import { requirePermission } from "@/lib/permissions";
import { getScopedPrisma } from "@/lib/scoped-prisma";
import { PAGE_SIZE, parsePage } from "@/lib/pagination";
import Pagination from "@/components/Pagination";
import ListSearch from "@/components/ListSearch";
import InventoryForm from "./InventoryForm";
import { inventoryTypeLabel, inventoryStatusLabel, inventoryStatusStyle } from "@/lib/procurementLabels";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Prisma } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

export default async function InventoryPage({ searchParams }: { searchParams: Promise<{ page?: string; q?: string }> }) {
  const user = await requireCurrentUser();

  try {
    await requirePermission(user.roleId, "Inventory", "View");
  } catch {
    return (
      <main className="mx-auto max-w-3xl px-6 py-10">
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-6 text-center text-sm text-destructive">
          معندكش صلاحية الوصول للصفحة دي — متاحة لـProcurementOfficer/Admin/CompanyOwner.
        </div>
      </main>
    );
  }

  const { q } = await searchParams;
  const page = parsePage((await searchParams).page);
  const orgId = user.orgId;
  const prisma = await getScopedPrisma();

  // ⚠️ Pagination + بحث — قبل كده الصفحة دي كانت بتحمّل كل سجلات المخزون بلا حد أقصى
  // (باگ أداء حقيقي اتلقط في مراجعة وحدة 7)، نفس نمط companies/sourcing.
  const where: Prisma.InventoryWhereInput = {
    orgId,
    ...(q ? { product: { nameAr: { contains: q, mode: "insensitive" } } } : {}),
  };

  // ⚠️ مش Promise.all — راجع BACKLOG.md (P2028).
  const records = await prisma.inventory.findMany({
    where,
    include: { product: true, batch: true, lot: true },
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });
  const total = await prisma.inventory.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const products = await prisma.product.findMany({
    where: { orgId, deletedAt: null },
    select: { id: true, nameAr: true },
    orderBy: { nameAr: "asc" },
  });
  const batches = await prisma.batch.findMany({
    where: { orgId },
    select: { id: true, batchCode: true },
    orderBy: { createdAt: "desc" },
  });
  const lots = await prisma.lot.findMany({
    where: { orgId },
    select: { id: true, lotCode: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">المخزون</h1>
        <p className="mt-1 text-sm text-muted-foreground">{total} سجل مخزون</p>
      </div>

      <div className="mt-6">
        <InventoryForm products={products} batches={batches} lots={lots} />
      </div>

      <div className="mt-6">
        <ListSearch basePath="/inventory" q={q} placeholder="اسم المنتج..." />
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>المنتج</TableHead>
              <TableHead>النوع</TableHead>
              <TableHead>الكمية</TableHead>
              <TableHead>الدفعة/الـLot</TableHead>
              <TableHead>الموقع</TableHead>
              <TableHead>الحالة</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-6 text-center text-muted-foreground">
                  لسه مفيش سجلات مخزون.
                </TableCell>
              </TableRow>
            ) : (
              records.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium text-foreground">{r.product.nameAr}</TableCell>
                  <TableCell className="text-foreground/80">{inventoryTypeLabel[r.inventoryType]}</TableCell>
                  <TableCell className="font-mono text-foreground/80">
                    {r.quantity.toString()} {r.unit ?? ""}
                  </TableCell>
                  <TableCell className="text-foreground/80">{r.batch?.batchCode ?? r.lot?.lotCode ?? "—"}</TableCell>
                  <TableCell className="text-foreground/80">{r.location ?? "—"}</TableCell>
                  <TableCell>
                    <Badge className={inventoryStatusStyle[r.status]}>{inventoryStatusLabel[r.status]}</Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <Pagination currentPage={page} totalPages={totalPages} basePath="/inventory" extraParams={{ q }} />
    </main>
  );
}
