import Link from "next/link";
import { getScopedPrisma } from "@/lib/scoped-prisma";
import { requireCurrentUser } from "@/lib/session";
import { getPermissionScope, ownerScopeWhere } from "@/lib/permissions";
import { restoreCompany } from "../actions";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const dynamic = "force-dynamic";

export default async function ArchivedCompaniesPage() {
  const user = await requireCurrentUser();
  const orgId = user.orgId;
  const prisma = await getScopedPrisma();

  // نفس فلترة Own/Team scope المستخدمة في /companies — راجع BACKLOG.md.
  const scope = await getPermissionScope(user.roleId, "Company", "View");
  const ownerFilter = await ownerScopeWhere(scope, user);

  const companies = await prisma.company.findMany({
    where: { orgId, deletedAt: { not: null }, ...ownerFilter },
    orderBy: { deletedAt: "desc" },
  });

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">الشركات المؤرشفة</h1>
          <p className="mt-1 text-sm text-muted-foreground">{companies.length} شركة مؤرشفة</p>
        </div>
        <Button nativeButton={false} variant="outline" render={<Link href="/companies">← رجوع للشركات</Link>} />
      </div>

      {companies.length === 0 ? (
        <div className="mt-10 rounded-xl border border-dashed border-border py-16 text-center text-muted-foreground">
          <p>مفيش شركات مؤرشفة دلوقتي.</p>
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الاسم</TableHead>
                <TableHead>الدولة</TableHead>
                <TableHead>تاريخ الأرشفة</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {companies.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <div className="font-medium text-foreground">{c.legalName}</div>
                    {c.tradeName && <div className="text-xs text-muted-foreground">{c.tradeName}</div>}
                  </TableCell>
                  <TableCell className="text-foreground/80">{c.country}</TableCell>
                  <TableCell className="text-foreground/80">
                    {c.deletedAt?.toLocaleDateString("ar-EG")}
                  </TableCell>
                  <TableCell className="text-end">
                    <form action={restoreCompany.bind(null, c.id)}>
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
    </main>
  );
}
