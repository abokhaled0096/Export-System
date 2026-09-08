import Link from "next/link";
import { getScopedPrisma } from "@/lib/scoped-prisma";
import { requireCurrentUser } from "@/lib/session";
import { getPermissionScope, ownerScopeWhere } from "@/lib/permissions";
import { archiveCompany } from "./actions";
import { PAGE_SIZE, parsePage } from "@/lib/pagination";
import Pagination from "@/components/Pagination";
import ListSearch from "@/components/ListSearch";
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
import type { CompanyStatus } from "@/generated/prisma/enums";
import { companyClassificationLabel } from "@/lib/companyLabels";

export const dynamic = "force-dynamic";

const statusLabel: Record<string, string> = {
  Lead: "عميل محتمل",
  Suspect: "غير مؤكد",
  Prospect: "مرشّح",
  Qualified: "مؤهّل",
  ActiveOpportunity: "فرصة نشطة",
  Customer: "عميل",
  RepeatCustomer: "عميل متكرر",
  StrategicAccount: "حساب استراتيجي",
  Dormant: "خامل",
  Rejected: "مرفوض",
  Blacklisted: "قائمة سوداء",
};

const statuses = Object.keys(statusLabel);

export default async function CompaniesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; status?: string }>;
}) {
  const user = await requireCurrentUser();
  const orgId = user.orgId;
  const prisma = await getScopedPrisma();
  const { q, status } = await searchParams;
  const page = parsePage((await searchParams).page);
  // Own/Team scope (مثلًا SalesRep/TeamLead) بيشوف بس الشركات اللي مالكها هو أو فريقه — راجع BACKLOG.md.
  // scope === null (مفيش صلاحية View صريحة) بيسيب العرض بلا فلترة، عشان الأدوار اللي
  // معندهاش صلاحيات مسار المبيعات لسه (Finance/ComplianceOfficer...) ميتأثروش بالتغيير ده.
  const scope = await getPermissionScope(user.roleId, "Company", "View");
  const ownerFilter = await ownerScopeWhere(scope, user);

  const where: Prisma.CompanyWhereInput = {
    orgId,
    deletedAt: null,
    ...ownerFilter,
    ...(q
      ? {
          OR: [
            { legalName: { contains: q, mode: "insensitive" } },
            { tradeName: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(status && statuses.includes(status) ? { status: status as CompanyStatus } : {}),
  };

  // ⚠️ مش Promise.all — راجع نفس الملاحظة في products/page.tsx (P2028).
  const companies = await prisma.company.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { contacts: true, opportunities: true } } },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });
  const total = await prisma.company.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">الشركات</h1>
          <p className="mt-1 text-sm text-muted-foreground">{total} شركة مسجّلة</p>
        </div>
        <div className="flex gap-2">
          <Button
            nativeButton={false}
            variant="outline"
            render={
              <a href={`/companies/export?${new URLSearchParams({ ...(q ? { q } : {}), ...(status ? { status } : {}) }).toString()}`}>
                تصدير CSV
              </a>
            }
          />
          <Button nativeButton={false} render={<Link href="/companies/new">+ شركة جديدة</Link>} />
          <Button nativeButton={false} variant="outline" render={<Link href="/companies/import">استيراد CSV</Link>} />
          <Button nativeButton={false} variant="outline" render={<Link href="/companies/archived">الأرشيف</Link>} />
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <Button nativeButton={false} variant={!status ? "secondary" : "ghost"} size="sm" render={<Link href={q ? `/companies?q=${encodeURIComponent(q)}` : "/companies"} />}>
            الكل
          </Button>
          {statuses.map((s) => (
            <Button
              key={s}
              nativeButton={false}
              variant={status === s ? "secondary" : "ghost"}
              size="sm"
              render={<Link href={`/companies?status=${s}${q ? `&q=${encodeURIComponent(q)}` : ""}`} />}
            >
              {statusLabel[s]}
            </Button>
          ))}
        </div>
        <ListSearch basePath="/companies" q={q} hiddenParams={{ status }} placeholder="اسم الشركة..." />
      </div>

      {companies.length === 0 ? (
        <div className="mt-10 rounded-xl border border-dashed border-border py-16 text-center text-muted-foreground">
          {q || status ? (
            <p>مفيش شركات مطابقة للفلتر ده.</p>
          ) : (
            <>
              <p>لسه مفيش شركات مسجّلة.</p>
              <Button nativeButton={false} variant="link" render={<Link href="/companies/new">سجّل أول شركة</Link>} />
            </>
          )}
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الاسم</TableHead>
                <TableHead>الدولة</TableHead>
                <TableHead>التصنيف</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead>جهات اتصال</TableHead>
                <TableHead>فرص</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {companies.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <Button nativeButton={false} variant="link" className="h-auto p-0 font-medium" render={<Link href={`/companies/${c.id}`}>{c.legalName}</Link>} />
                    {c.tradeName && <div className="text-xs text-muted-foreground">{c.tradeName}</div>}
                  </TableCell>
                  <TableCell className="text-foreground/80">
                    {c.country}
                    {c.city ? ` · ${c.city}` : ""}
                  </TableCell>
                  <TableCell className="text-foreground/80">
                    {c.classification.map((cl) => companyClassificationLabel[cl] ?? cl).join("، ")}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{statusLabel[c.status]}</Badge>
                  </TableCell>
                  <TableCell className="font-mono text-foreground/80">{c._count.contacts}</TableCell>
                  <TableCell className="font-mono text-foreground/80">{c._count.opportunities}</TableCell>
                  <TableCell className="text-end">
                    <form action={archiveCompany.bind(null, c.id)}>
                      <Button type="submit" variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive">
                        أرشفة
                      </Button>
                    </form>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <Pagination currentPage={page} totalPages={totalPages} basePath="/companies" extraParams={{ q, status }} />
    </main>
  );
}
