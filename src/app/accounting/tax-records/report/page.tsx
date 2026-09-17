import Link from "next/link";
import { Prisma } from "@/generated/prisma/client";
import { requireCurrentUser } from "@/lib/session";
import { requirePermission } from "@/lib/permissions";
import { getScopedPrisma } from "@/lib/scoped-prisma";
import { taxTypeLabel, taxFilingStatusLabel, taxFilingStatusStyle } from "@/lib/treasuryLabels";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const dynamic = "force-dynamic";

const TAX_TYPES = ["VATOutput", "VATInput", "WithholdingTax", "PayrollTax"] as const;

const zero = () => new Prisma.Decimal(0);

export default async function TaxReportPage() {
  const user = await requireCurrentUser();

  try {
    await requirePermission(user.roleId, "TaxRecord", "View");
  } catch {
    return (
      <main className="mx-auto max-w-3xl px-6 py-10">
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-6 text-center text-sm text-destructive">
          معندكش صلاحية الوصول للصفحة دي.
        </div>
      </main>
    );
  }

  const orgId = user.orgId;
  const prisma = await getScopedPrisma();

  const records = await prisma.taxRecord.findMany({
    where: { orgId },
    orderBy: [{ period: { startDate: "desc" } }],
    include: { period: { select: { id: true, periodName: true } } },
  });

  // تجميع حسب الفترة — كل فترة صف واحد، وكل نوع ضريبة عمود (مفيش أكتر من سجل واحد
  // لكل فترة/نوع أصلًا — @@unique([orgId, taxType, periodId]) في الـschema).
  type PeriodRow = {
    periodId: string;
    periodName: string;
    byType: Partial<Record<(typeof TAX_TYPES)[number], (typeof records)[number]>>;
    totalFiled: Prisma.Decimal;
    totalPaid: Prisma.Decimal;
  };

  const periodRows = records.reduce<PeriodRow[]>((rows, r) => {
    let row = rows.find((x) => x.periodId === r.period.id);
    if (!row) {
      row = { periodId: r.period.id, periodName: r.period.periodName, byType: {}, totalFiled: zero(), totalPaid: zero() };
      rows.push(row);
    }
    row.byType[r.taxType] = r;
    if (r.filingStatus === "Filed") row.totalFiled = row.totalFiled.add(r.amount);
    if (r.filingStatus === "Paid") row.totalPaid = row.totalPaid.add(r.amount);
    return rows;
  }, []);

  const grandTotalFiled = periodRows.reduce((sum, r) => sum.add(r.totalFiled), zero());
  const grandTotalPaid = periodRows.reduce((sum, r) => sum.add(r.totalPaid), zero());

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <Link href="/accounting/tax-records" className="text-sm text-muted-foreground hover:underline">
        → لوحة الضرائب
      </Link>
      <h1 className="mt-3 text-2xl font-semibold text-foreground">التقرير الضريبي التجميعي</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        تجميع كل الإقرارات الضريبية المسجَّلة ({records.length}) حسب الفترة المحاسبية — بيانات من `TaxRecord` مباشرة، مفيش
        شكل رسمي مخترع لمصلحة الضرائب (مرجع `etaReference` بس لو موجود لكل سجل).
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-5">
          <p className="text-xs text-muted-foreground">إجمالي مستحق (مُقدَّم، لسه ما اتسددش)</p>
          <p className="mt-1 font-mono text-2xl font-semibold text-amber-700">{grandTotalFiled.toFixed(2)}</p>
        </div>
        <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-5">
          <p className="text-xs text-muted-foreground">إجمالي مسدَّد</p>
          <p className="mt-1 font-mono text-2xl font-semibold text-emerald-700">{grandTotalPaid.toFixed(2)}</p>
        </div>
      </div>

      <div className="mt-6 overflow-x-auto rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="sticky right-0 bg-card">الفترة</TableHead>
              {TAX_TYPES.map((t) => (
                <TableHead key={t}>{taxTypeLabel[t]}</TableHead>
              ))}
              <TableHead>مستحق الفترة</TableHead>
              <TableHead>مسدَّد الفترة</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {periodRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={TAX_TYPES.length + 3} className="py-6 text-center text-muted-foreground">
                  لسه مفيش إقرارات ضريبية مسجَّلة.
                </TableCell>
              </TableRow>
            ) : (
              periodRows.map((row) => (
                <TableRow key={row.periodId}>
                  <TableCell className="sticky right-0 bg-card font-medium text-foreground">{row.periodName}</TableCell>
                  {TAX_TYPES.map((t) => {
                    const rec = row.byType[t];
                    return (
                      <TableCell key={t} className="text-xs">
                        {rec ? (
                          <div className="flex flex-col gap-1">
                            <span className="font-mono text-foreground">
                              {rec.amount.toFixed(2)} {rec.currency}
                            </span>
                            <Badge className={taxFilingStatusStyle[rec.filingStatus]}>{taxFilingStatusLabel[rec.filingStatus]}</Badge>
                            {rec.etaReference && <span className="text-muted-foreground">ETA: {rec.etaReference}</span>}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    );
                  })}
                  <TableCell className="font-mono text-sm font-medium text-amber-700">{row.totalFiled.toFixed(2)}</TableCell>
                  <TableCell className="font-mono text-sm font-medium text-emerald-700">{row.totalPaid.toFixed(2)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        &quot;مستحق الفترة&quot;/&quot;مسدَّد الفترة&quot; بيجمعوا مبالغ بعملات مختلفة لو الإقرارات مسجَّلة بأكتر من عملة — مؤشر تقريبي بس في
        الحالة دي، مش رقم محاسبي دقيق (نفس تحذير شاشة التدفّق النقدي).
      </p>
    </main>
  );
}
