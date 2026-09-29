import Link from "next/link";
import { requireCurrentUser } from "@/lib/session";
import { requirePermission, getPermissionScope, scopedOwnerIdFilter } from "@/lib/permissions";
import { getScopedPrisma } from "@/lib/scoped-prisma";
import { PAGE_SIZE, parsePage } from "@/lib/pagination";
import Pagination from "@/components/Pagination";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function QuoteBundlesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const user = await requireCurrentUser();

  try {
    await requirePermission(user.roleId, "QuoteBundle", "View");
  } catch {
    return (
      <main className="mx-auto max-w-3xl px-6 py-10">
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-6 text-center text-sm text-destructive">
          معندكش صلاحية الوصول للصفحة دي.
        </div>
      </main>
    );
  }

  const prisma = await getScopedPrisma();
  const page = parsePage((await searchParams).page);

  // مراجعة وحدة 2 (6 سبتمبر): بلا الفلتر ده كل الحزم كانت ظاهرة لأي حد عنده QuoteBundle.View
  // بغض النظر عن الـscope بتاعه — يعني SalesRep (Own) كان يشوف أسعار عروض مندوبين تانيين.
  const scope = await getPermissionScope(user.roleId, "QuoteBundle", "View");
  const scopedOwnerId = await scopedOwnerIdFilter(scope, user);
  const ownerFilter = scopedOwnerId !== undefined ? { quotes: { some: { deal: { opportunity: { ownerId: scopedOwnerId } } } } } : {};
  const where = { orgId: user.orgId, ...ownerFilter };

  const bundles = await prisma.quoteBundle.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { customer: { select: { legalName: true } }, createdByUser: { select: { fullName: true } }, _count: { select: { quotes: true } } },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });
  const total = await prisma.quoteBundle.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">حزم عروض الأسعار</h1>
          <p className="mt-1 text-sm text-muted-foreground">{total} حزمة — تجميع عروض أسعار مستقلة (لنفس العميل) في مستند واحد.</p>
        </div>
        <Button nativeButton={false} render={<Link href="/quote-bundles/new">+ حزمة جديدة</Link>} />
      </div>

      {bundles.length === 0 ? (
        <div className="mt-10 rounded-xl border border-dashed border-border py-16 text-center text-muted-foreground">
          <p>لسه مفيش حزم مسجّلة.</p>
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>العميل</TableHead>
                <TableHead>عدد العروض</TableHead>
                <TableHead>اتعملت بمعرفة</TableHead>
                <TableHead>التاريخ</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bundles.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="text-foreground">{b.customer.legalName}</TableCell>
                  <TableCell className="font-mono text-foreground/80">{b._count.quotes}</TableCell>
                  <TableCell className="text-foreground/80">{b.createdByUser.fullName}</TableCell>
                  <TableCell className="text-foreground/80">{formatDate(b.createdAt)}</TableCell>
                  <TableCell>
                    <Link href={`/quote-bundles/${b.id}`} className="text-sm text-primary hover:underline">
                      تفاصيل
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <Pagination currentPage={page} totalPages={totalPages} basePath="/quote-bundles" />
    </main>
  );
}
