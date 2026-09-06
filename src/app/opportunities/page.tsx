import Link from "next/link";
import { getScopedPrisma } from "@/lib/scoped-prisma";
import { requireCurrentUser } from "@/lib/session";
import { getPermissionScope, ownerScopeWhere } from "@/lib/permissions";
import { archiveOpportunity } from "./actions";
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
import type { OpportunityStage } from "@/generated/prisma/enums";

export const dynamic = "force-dynamic";

const stageLabel: Record<string, string> = {
  NewLead: "عميل محتمل جديد",
  Contacted: "تم التواصل",
  Qualified: "مؤهّلة",
  QuoteSent: "تم إرسال عرض",
  Won: "مكسوبة",
  Lost: "خسرانة",
};

const stageStyle: Record<string, string> = {
  NewLead: "bg-secondary text-secondary-foreground hover:bg-secondary",
  Contacted: "bg-sky-100 text-sky-700 hover:bg-sky-100",
  Qualified: "bg-amber-100 text-amber-700 hover:bg-amber-100",
  QuoteSent: "bg-violet-100 text-violet-700 hover:bg-violet-100",
  Won: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  Lost: "bg-rose-100 text-rose-700 hover:bg-rose-100",
};

const stages = Object.keys(stageLabel);

export default async function OpportunitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; stage?: string }>;
}) {
  const user = await requireCurrentUser();
  const orgId = user.orgId;
  const prisma = await getScopedPrisma();
  const { q, stage } = await searchParams;
  const page = parsePage((await searchParams).page);
  // Own/Team scope (مثلًا SalesRep/TeamLead) بيشوف بس الفرص اللي مالكها هو أو فريقه — راجع BACKLOG.md.
  const scope = await getPermissionScope(user.roleId, "Opportunity", "View");
  const ownerFilter = await ownerScopeWhere(scope, user);

  const where: Prisma.OpportunityWhereInput = {
    orgId,
    deletedAt: null,
    ...ownerFilter,
    ...(q ? { company: { legalName: { contains: q, mode: "insensitive" } } } : {}),
    ...(stage && stages.includes(stage) ? { stage: stage as OpportunityStage } : {}),
  };

  // ⚠️ مش Promise.all — راجع نفس الملاحظة في products/page.tsx (P2028).
  const opportunities = await prisma.opportunity.findMany({
    where,
    include: { company: true, product: true, market: true },
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });
  const total = await prisma.opportunity.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">الفرص</h1>
          <p className="mt-1 text-sm text-muted-foreground">{total} فرصة مسجّلة</p>
        </div>
        <div className="flex gap-2">
          <Button
            nativeButton={false}
            variant="outline"
            render={
              <a href={`/opportunities/export?${new URLSearchParams({ ...(q ? { q } : {}), ...(stage ? { stage } : {}) }).toString()}`}>
                تصدير CSV
              </a>
            }
          />
          <Button nativeButton={false} render={<Link href="/opportunities/new">+ فرصة جديدة</Link>} />
          <Button nativeButton={false} variant="outline" render={<Link href="/opportunities/archived">الأرشيف</Link>} />
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <Button nativeButton={false} variant={!stage ? "secondary" : "ghost"} size="sm" render={<Link href={q ? `/opportunities?q=${encodeURIComponent(q)}` : "/opportunities"} />}>
            الكل
          </Button>
          {stages.map((s) => (
            <Button
              key={s}
              nativeButton={false}
              variant={stage === s ? "secondary" : "ghost"}
              size="sm"
              render={<Link href={`/opportunities?stage=${s}${q ? `&q=${encodeURIComponent(q)}` : ""}`} />}
            >
              {stageLabel[s]}
            </Button>
          ))}
        </div>
        <ListSearch basePath="/opportunities" q={q} hiddenParams={{ stage }} placeholder="اسم الشركة..." />
      </div>

      {opportunities.length === 0 ? (
        <div className="mt-10 rounded-xl border border-dashed border-border py-16 text-center text-muted-foreground">
          {q || stage ? (
            <p>مفيش فرص مطابقة للفلتر ده.</p>
          ) : (
            <>
              <p>لسه مفيش فرص مسجّلة.</p>
              <Button nativeButton={false} variant="link" render={<Link href="/opportunities/new">سجّل أول فرصة</Link>} />
            </>
          )}
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الشركة</TableHead>
                <TableHead>المنتج</TableHead>
                <TableHead>السوق</TableHead>
                <TableHead>القيمة المتوقعة</TableHead>
                <TableHead>المرحلة</TableHead>
                <TableHead></TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {opportunities.map((o) => (
                <TableRow key={o.id}>
                  <TableCell>
                    <Button nativeButton={false} variant="link" className="h-auto p-0 font-medium" render={<Link href={`/companies/${o.companyId}`}>{o.company.legalName}</Link>} />
                  </TableCell>
                  <TableCell className="text-foreground/80">{o.product.nameAr}</TableCell>
                  <TableCell className="text-foreground/80">{o.market.countryNameAr}</TableCell>
                  <TableCell className="font-mono text-foreground/80">
                    {o.expectedValue ? `${o.expectedValue} ${o.currency ?? ""}` : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge className={stageStyle[o.stage]}>{stageLabel[o.stage]}</Badge>
                  </TableCell>
                  <TableCell>
                    <Button nativeButton={false} variant="link" className="h-auto p-0" render={<Link href={`/deals/new?opportunityId=${o.id}`}>حوّل لصفقة →</Link>} />
                  </TableCell>
                  <TableCell className="text-end">
                    <form action={archiveOpportunity.bind(null, o.id)}>
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
      <Pagination currentPage={page} totalPages={totalPages} basePath="/opportunities" extraParams={{ q, stage }} />
    </main>
  );
}
