import Link from "next/link";
import { requireCurrentUser } from "@/lib/session";
import { requirePermission } from "@/lib/permissions";
import { getScopedPrisma } from "@/lib/scoped-prisma";
import { PAGE_SIZE, parsePage } from "@/lib/pagination";
import Pagination from "@/components/Pagination";
import JournalEntryForm from "./JournalEntryForm";
import { journalEntrySourceTypeLabel, journalEntryStatusLabel, journalEntryStatusStyle } from "@/lib/accountingLabels";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function JournalEntriesPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const user = await requireCurrentUser();

  try {
    await requirePermission(user.roleId, "JournalEntry", "View");
  } catch {
    return (
      <main className="mx-auto max-w-3xl px-6 py-10">
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-6 text-center text-sm text-destructive">
          معندكش صلاحية الوصول للصفحة دي — متاحة لدور Finance/Admin/CompanyOwner.
        </div>
      </main>
    );
  }

  const page = parsePage((await searchParams).page);
  const orgId = user.orgId;
  const prisma = await getScopedPrisma();

  const records = await prisma.journalEntry.findMany({
    where: { orgId },
    include: { period: { select: { periodName: true } } },
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });
  const total = await prisma.journalEntry.count({ where: { orgId } });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // ⚠️ مش Promise.all — راجع BACKLOG.md (P2028).
  const periods = await prisma.accountingPeriod.findMany({
    where: { orgId, status: "Open" },
    select: { id: true, periodName: true },
    orderBy: { startDate: "desc" },
  });
  const accounts = await prisma.chartOfAccount.findMany({
    where: { orgId, isActive: true },
    select: { id: true, accountCode: true, nameAr: true },
    orderBy: { accountCode: "asc" },
  });
  const costCenters = await prisma.costCenter.findMany({ where: { orgId }, select: { id: true, code: true, name: true }, orderBy: { code: "asc" } });
  const profitCenters = await prisma.profitCenter.findMany({ where: { orgId }, select: { id: true, code: true, name: true }, orderBy: { code: "asc" } });

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">القيود اليومية</h1>
        <p className="mt-1 text-sm text-muted-foreground">{total} قيد مسجّل</p>
      </div>

      {periods.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">لازم فترة محاسبية مفتوحة الأول — راجع صفحة الفترات المحاسبية.</p>
      ) : accounts.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">لازم حسابات مسجّلة الأول — راجع صفحة شجرة الحسابات.</p>
      ) : (
        <div className="mt-6">
          <JournalEntryForm periods={periods} accounts={accounts} costCenters={costCenters} profitCenters={profitCenters} defaultCurrency="EGP" />
        </div>
      )}

      <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>الرقم</TableHead>
              <TableHead>التاريخ</TableHead>
              <TableHead>الفترة</TableHead>
              <TableHead>المصدر</TableHead>
              <TableHead>الحالة</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-6 text-center text-muted-foreground">
                  لسه مفيش قيود مسجّلة.
                </TableCell>
              </TableRow>
            ) : (
              records.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="font-mono text-foreground">
                    <Link href={`/accounting/journal-entries/${e.id}`} className="underline">
                      {e.entryNumber}
                    </Link>
                  </TableCell>
                  <TableCell className="text-foreground/80">{formatDate(e.entryDate)}</TableCell>
                  <TableCell className="text-foreground/80">{e.period.periodName}</TableCell>
                  <TableCell className="text-foreground/80">{journalEntrySourceTypeLabel[e.sourceType]}</TableCell>
                  <TableCell>
                    <Badge className={journalEntryStatusStyle[e.status]}>{journalEntryStatusLabel[e.status]}</Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <Pagination currentPage={page} totalPages={totalPages} basePath="/accounting/journal-entries" extraParams={{}} />
    </main>
  );
}
