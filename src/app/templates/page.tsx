import { requireCurrentUser } from "@/lib/session";
import { requirePermission } from "@/lib/permissions";
import { getScopedPrisma } from "@/lib/scoped-prisma";
import { PAGE_SIZE, parsePage } from "@/lib/pagination";
import Pagination from "@/components/Pagination";
import TemplateForm from "./TemplateForm";
import { documentTypeLabel, documentLanguageLabel } from "@/lib/documentLabels";
import { templateStatusLabel, templateStatusStyle } from "@/lib/templateLabels";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const dynamic = "force-dynamic";

export default async function TemplatesPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const user = await requireCurrentUser();

  try {
    await requirePermission(user.roleId, "Template", "View");
  } catch {
    return (
      <main className="mx-auto max-w-3xl px-6 py-10">
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-6 text-center text-sm text-destructive">
          معندكش صلاحية الوصول للصفحة دي.
        </div>
      </main>
    );
  }

  const page = parsePage((await searchParams).page);
  const orgId = user.orgId;
  const prisma = await getScopedPrisma();

  const records = await prisma.template.findMany({
    where: { orgId },
    include: { market: { select: { countryNameAr: true } }, customer: { select: { legalName: true } } },
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });
  const total = await prisma.template.count({ where: { orgId } });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // ⚠️ مش Promise.all — راجع BACKLOG.md (P2028).
  const markets = await prisma.market.findMany({
    where: { orgId, deletedAt: null },
    select: { id: true, countryNameAr: true },
    orderBy: { countryNameAr: "asc" },
  });
  const customers = await prisma.company.findMany({
    where: { orgId, deletedAt: null },
    select: { id: true, legalName: true },
    orderBy: { legalName: "asc" },
  });

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">القوالب</h1>
        <p className="mt-1 text-sm text-muted-foreground">{total} قالب مسجّل</p>
      </div>

      <div className="mt-6">
        <TemplateForm markets={markets} customers={customers} />
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>نوع المستند</TableHead>
              <TableHead>اللغة</TableHead>
              <TableHead>السوق</TableHead>
              <TableHead>العميل</TableHead>
              <TableHead>النسخة</TableHead>
              <TableHead>الحالة</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-6 text-center text-muted-foreground">
                  لسه مفيش قوالب مسجّلة.
                </TableCell>
              </TableRow>
            ) : (
              records.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="text-foreground">{documentTypeLabel[t.documentType]}</TableCell>
                  <TableCell className="text-foreground/80">{documentLanguageLabel[t.language]}</TableCell>
                  <TableCell className="text-foreground/80">{t.market?.countryNameAr ?? "—"}</TableCell>
                  <TableCell className="text-foreground/80">{t.customer?.legalName ?? "—"}</TableCell>
                  <TableCell className="font-mono text-foreground/80">{t.version}</TableCell>
                  <TableCell>
                    <Badge className={templateStatusStyle[t.status]}>{templateStatusLabel[t.status]}</Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <Pagination currentPage={page} totalPages={totalPages} basePath="/templates" extraParams={{}} />
    </main>
  );
}
