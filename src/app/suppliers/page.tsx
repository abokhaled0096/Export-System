import Link from "next/link";
import { requireCurrentUser } from "@/lib/session";
import { requirePermission } from "@/lib/permissions";
import { getScopedPrisma } from "@/lib/scoped-prisma";
import { PAGE_SIZE, parsePage } from "@/lib/pagination";
import Pagination from "@/components/Pagination";
import ListSearch from "@/components/ListSearch";
import SupplierForm from "./SupplierForm";
import { supplierTypeLabel, supplierStatusLabel, supplierStatusStyle } from "@/lib/procurementLabels";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Prisma } from "@/generated/prisma/client";
import FormDialog from "@/components/FormDialog";

export const dynamic = "force-dynamic";

export default async function SuppliersPage({ searchParams }: { searchParams: Promise<{ page?: string; q?: string }> }) {
  const user = await requireCurrentUser();

  try {
    await requirePermission(user.roleId, "Supplier", "View");
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
  const prisma = await getScopedPrisma();

  // ⚠️ Pagination + بحث — قبل كده الصفحة دي كانت بتحمّل كل الموردين بلا حد أقصى (باگ أداء
  // حقيقي اتلقط في مراجعة وحدة 7)، نفس نمط companies/sourcing.
  const where: Prisma.SupplierWhereInput = {
    orgId: user.orgId,
    deletedAt: null,
    ...(q
      ? {
          OR: [
            { legalName: { contains: q, mode: "insensitive" } },
            { tradeName: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  // ⚠️ مش Promise.all — راجع BACKLOG.md (P2028).
  const suppliers = await prisma.supplier.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });
  const total = await prisma.supplier.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">الموردون</h1>
        <p className="mt-1 text-sm text-muted-foreground">{total} مورّد مسجّل</p>
      </div>

      <div className="mt-6 flex justify-start">
        <FormDialog triggerLabel="+ مورّد" title="مورّد جديد">
          <SupplierForm />
        </FormDialog>
      </div>

      <div className="mt-6">
        <ListSearch basePath="/suppliers" q={q} placeholder="الاسم القانوني/التجاري..." />
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>الاسم</TableHead>
              <TableHead>النوع</TableHead>
              <TableHead>الدولة</TableHead>
              <TableHead>الحالة</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {suppliers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-6 text-center text-muted-foreground">
                  لسه مفيش موردين مسجّلين.
                </TableCell>
              </TableRow>
            ) : (
              suppliers.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    <Button nativeButton={false} variant="link" className="h-auto p-0 font-medium" render={<Link href={`/suppliers/${s.id}`}>{s.legalName}</Link>} />
                  </TableCell>
                  <TableCell className="text-foreground/80">
                    {s.supplierType.map((t) => supplierTypeLabel[t] ?? t).join("، ") || "—"}
                  </TableCell>
                  <TableCell className="text-foreground/80">{s.country ?? "—"}</TableCell>
                  <TableCell>
                    <Badge className={supplierStatusStyle[s.status]}>{supplierStatusLabel[s.status]}</Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <Pagination currentPage={page} totalPages={totalPages} basePath="/suppliers" extraParams={{ q }} />
    </main>
  );
}
