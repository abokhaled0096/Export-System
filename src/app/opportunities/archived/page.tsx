import Link from "next/link";
import { getScopedPrisma } from "@/lib/scoped-prisma";
import { requireCurrentUser } from "@/lib/session";
import { getPermissionScope, ownerScopeWhere } from "@/lib/permissions";
import { restoreOpportunity } from "../actions";
import { PAGE_SIZE, parsePage } from "@/lib/pagination";
import Pagination from "@/components/Pagination";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ArchivedOpportunitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const user = await requireCurrentUser();
  const orgId = user.orgId;
  const prisma = await getScopedPrisma();
  const page = parsePage((await searchParams).page);

  // نفس فلترة Own/Team scope المستخدمة في /opportunities — راجع BACKLOG.md.
  const scope = await getPermissionScope(user.roleId, "Opportunity", "View");
  const ownerFilter = await ownerScopeWhere(scope, user);
  const where = { orgId, deletedAt: { not: null }, ...ownerFilter };

  const opportunities = await prisma.opportunity.findMany({
    where,
    include: { company: true, product: true, market: true },
    orderBy: { deletedAt: "desc" },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });
  const total = await prisma.opportunity.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">الفرص المؤرشفة</h1>
          <p className="mt-1 text-sm text-muted-foreground">{total} فرصة مؤرشفة</p>
        </div>
        <Button nativeButton={false} variant="outline" render={<Link href="/opportunities">← رجوع للفرص</Link>} />
      </div>

      {opportunities.length === 0 ? (
        <div className="mt-10 rounded-xl border border-dashed border-border py-16 text-center text-muted-foreground">
          <p>مفيش فرص مؤرشفة دلوقتي.</p>
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الشركة</TableHead>
                <TableHead>المنتج</TableHead>
                <TableHead>السوق</TableHead>
                <TableHead>تاريخ الأرشفة</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {opportunities.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="font-medium text-foreground">{o.company.legalName}</TableCell>
                  <TableCell className="text-foreground/80">{o.product.nameAr}</TableCell>
                  <TableCell className="text-foreground/80">{o.market.countryNameAr}</TableCell>
                  <TableCell className="text-foreground/80">
                    {formatDate(o.deletedAt)}
                  </TableCell>
                  <TableCell className="text-end">
                    <form action={restoreOpportunity.bind(null, o.id)}>
                      <Button type="submit" variant="ghost" size="sm">
                        استعادة
                      </Button>
                    </form>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <Pagination currentPage={page} totalPages={totalPages} basePath="/opportunities/archived" />
    </main>
  );
}
