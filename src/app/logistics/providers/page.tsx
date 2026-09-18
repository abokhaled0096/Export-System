import Link from "next/link";
import { requireCurrentUser } from "@/lib/session";
import { requirePermission } from "@/lib/permissions";
import { getScopedPrisma } from "@/lib/scoped-prisma";
import ServiceProviderForm from "./ServiceProviderForm";
import { serviceProviderTypeLabel, serviceProviderStatusLabel, serviceProviderStatusStyle } from "@/lib/logisticsLabels";
import { PAGE_SIZE, parsePage } from "@/lib/pagination";
import Pagination from "@/components/Pagination";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const dynamic = "force-dynamic";

export default async function ServiceProvidersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const user = await requireCurrentUser();

  try {
    await requirePermission(user.roleId, "ServiceProvider", "View");
  } catch {
    return (
      <main className="mx-auto max-w-3xl px-6 py-10">
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-6 text-center text-sm text-destructive">
          معندكش صلاحية الوصول للصفحة دي — متاحة لـLogisticsOfficer/Admin/CompanyOwner.
        </div>
      </main>
    );
  }

  const prisma = await getScopedPrisma();
  const page = parsePage((await searchParams).page);
  const where = { orgId: user.orgId };
  const providers = await prisma.serviceProvider.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });
  const total = await prisma.serviceProvider.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <Button nativeButton={false} variant="link" className="px-0" render={<Link href="/logistics">← رجوع للوجستيات</Link>} />

      <div className="mt-3">
        <h1 className="text-2xl font-semibold text-foreground">مزوّدو الخدمة</h1>
        <p className="mt-1 text-sm text-muted-foreground">{total} مزوّد مسجّل</p>
      </div>

      <div className="mt-6">
        <ServiceProviderForm />
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>الاسم</TableHead>
              <TableHead>النوع</TableHead>
              <TableHead>الدولة</TableHead>
              <TableHead>الالتزام بالمواعيد</TableHead>
              <TableHead>الحالة</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {providers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-6 text-center text-muted-foreground">
                  لسه مفيش مزوّدين مسجّلين.
                </TableCell>
              </TableRow>
            ) : (
              providers.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium text-foreground">{p.name}</TableCell>
                  <TableCell className="text-foreground/80">{serviceProviderTypeLabel[p.providerType]}</TableCell>
                  <TableCell className="text-foreground/80">{p.country ?? "—"}</TableCell>
                  <TableCell className="font-mono text-foreground/80">{p.onTimePerformance ? `${p.onTimePerformance.toString()}%` : "—"}</TableCell>
                  <TableCell>
                    <Badge className={serviceProviderStatusStyle[p.status]}>{serviceProviderStatusLabel[p.status]}</Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <Pagination currentPage={page} totalPages={totalPages} basePath="/logistics/providers" />
    </main>
  );
}
