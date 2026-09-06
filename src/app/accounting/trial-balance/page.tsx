import { requireCurrentUser } from "@/lib/session";
import { requirePermission } from "@/lib/permissions";
import { getScopedPrisma } from "@/lib/scoped-prisma";
import { Prisma } from "@/generated/prisma/client";
import { accountTypeLabel } from "@/lib/accountingLabels";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function TrialBalancePage({ searchParams }: { searchParams: Promise<{ periodId?: string }> }) {
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

  const { periodId } = await searchParams;
  const orgId = user.orgId;
  const prisma = await getScopedPrisma();

  // المسودات (Draft) مستبعدة — مش قيود فعلية لسه. القيد المعكوس (Reversed) وعكسه (Posted) الاتنين
  // بيدخلوا عشان صافي أثرهم صفر فعليًا في الميزان — ده الصح محاسبيًا، مش استبعاد الأصل.
  const lineWhere: Prisma.JournalLineWhereInput = {
    orgId,
    journalEntry: { status: { in: ["Posted", "Reversed"] }, ...(periodId ? { periodId } : {}) },
  };

  const grouped = await prisma.journalLine.groupBy({
    by: ["accountId"],
    where: lineWhere,
    _sum: { debit: true, credit: true },
  });

  // ⚠️ مش Promise.all — راجع BACKLOG.md (P2028).
  const accounts = await prisma.chartOfAccount.findMany({
    where: { orgId, id: { in: grouped.map((g) => g.accountId) } },
    select: { id: true, accountCode: true, nameAr: true, accountType: true },
  });
  const periods = await prisma.accountingPeriod.findMany({
    where: { orgId },
    select: { id: true, periodName: true },
    orderBy: { startDate: "desc" },
  });

  const accountById = new Map(accounts.map((a) => [a.id, a]));
  const rows = grouped
    .map((g) => ({
      account: accountById.get(g.accountId),
      debit: new Prisma.Decimal(g._sum?.debit ?? 0),
      credit: new Prisma.Decimal(g._sum?.credit ?? 0),
    }))
    .filter((r) => r.account)
    .sort((a, b) => a.account!.accountCode.localeCompare(b.account!.accountCode));

  const totalDebit = rows.reduce((sum, r) => sum.add(r.debit), new Prisma.Decimal(0));
  const totalCredit = rows.reduce((sum, r) => sum.add(r.credit), new Prisma.Decimal(0));
  const balanced = totalDebit.equals(totalCredit);

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">ميزان المراجعة</h1>
        <p className="mt-1 text-sm text-muted-foreground">القيود المرحّلة بس — المسودات مش داخلة في الميزان.</p>
      </div>

      {periods.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button
            nativeButton={false}
            variant={!periodId ? "default" : "outline"}
            size="sm"
            render={<Link href="/accounting/trial-balance">كل الفترات</Link>}
          />
          {periods.map((p) => (
            <Button
              key={p.id}
              nativeButton={false}
              variant={periodId === p.id ? "default" : "outline"}
              size="sm"
              render={<Link href={`/accounting/trial-balance?periodId=${p.id}`}>{p.periodName}</Link>}
            />
          ))}
        </div>
      )}

      <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>الحساب</TableHead>
              <TableHead>النوع</TableHead>
              <TableHead>مدين</TableHead>
              <TableHead>دائن</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-6 text-center text-muted-foreground">
                  مفيش قيود مرحّلة في النطاق ده لسه.
                </TableCell>
              </TableRow>
            ) : (
              <>
                {rows.map((r) => (
                  <TableRow key={r.account!.id}>
                    <TableCell className="text-foreground">
                      {r.account!.accountCode} — {r.account!.nameAr}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{accountTypeLabel[r.account!.accountType]}</Badge>
                    </TableCell>
                    <TableCell className="font-mono text-foreground/80">{r.debit.toFixed(2)}</TableCell>
                    <TableCell className="font-mono text-foreground/80">{r.credit.toFixed(2)}</TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell className="font-medium text-foreground">الإجمالي</TableCell>
                  <TableCell>
                    {balanced ? (
                      <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">✓ متوازن</Badge>
                    ) : (
                      <Badge className="bg-rose-100 text-rose-700 hover:bg-rose-100">⚠ غير متوازن</Badge>
                    )}
                  </TableCell>
                  <TableCell className="font-mono font-medium text-foreground">{totalDebit.toFixed(2)}</TableCell>
                  <TableCell className="font-mono font-medium text-foreground">{totalCredit.toFixed(2)}</TableCell>
                </TableRow>
              </>
            )}
          </TableBody>
        </Table>
      </div>
    </main>
  );
}
