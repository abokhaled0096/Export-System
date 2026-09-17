import { Prisma } from "@/generated/prisma/client";
import { requireCurrentUser } from "@/lib/session";
import { requirePermission } from "@/lib/permissions";
import { getScopedPrisma } from "@/lib/scoped-prisma";
import { computeVatBalance } from "@/lib/accounting";
import ApproveVatButton from "./ApproveVatButton";
import PayTaxButton, { type BankAccountOption } from "./PayTaxButton";
import ManualTaxRecordForm, { type PeriodOption } from "./ManualTaxRecordForm";
import { taxTypeLabel, taxFilingStatusLabel, taxFilingStatusStyle } from "@/lib/treasuryLabels";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const dynamic = "force-dynamic";

export default async function TaxRecordsPage() {
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

  // ⚠️ مش Promise.all — راجع BACKLOG.md (P2028).
  const openPeriods = await prisma.accountingPeriod.findMany({
    where: { orgId, status: "Open" },
    orderBy: { startDate: "desc" },
    take: 1,
    select: { id: true, periodName: true },
  });
  const currentPeriod = openPeriods[0];

  // نفس الدالة المستخدمة داخل approveVatFilingAction — عرض ورقم الاعتماد بيرجعوا لمصدر واحد،
  // مش نسختين ممكن ينحرفوا عن بعض.
  let vatOutputBalance = new Prisma.Decimal(0);
  let vatInputBalance = new Prisma.Decimal(0);
  let alreadyFiledOutput = false;
  let alreadyFiledInput = false;

  if (currentPeriod) {
    const balance = await computeVatBalance(prisma, orgId, currentPeriod.id);
    vatOutputBalance = balance.output;
    vatInputBalance = balance.input;

    const existingFilings = await prisma.taxRecord.findMany({
      where: { orgId, periodId: currentPeriod.id, taxType: { in: ["VATOutput", "VATInput"] } },
      select: { taxType: true },
    });
    alreadyFiledOutput = existingFilings.some((f) => f.taxType === "VATOutput");
    alreadyFiledInput = existingFilings.some((f) => f.taxType === "VATInput");
  }
  const netPayable = vatOutputBalance.sub(vatInputBalance);

  const records = await prisma.taxRecord.findMany({
    where: { orgId },
    orderBy: [{ period: { startDate: "desc" } }],
    include: { period: { select: { periodName: true } } },
  });
  const org = await prisma.organization.findUniqueOrThrow({ where: { id: orgId }, select: { functionalCurrency: true } });
  const periods = await prisma.accountingPeriod.findMany({ where: { orgId }, orderBy: { startDate: "desc" }, select: { id: true, periodName: true } });
  const bankAccounts = await prisma.bankAccount.findMany({
    where: { orgId, isActive: true },
    select: { id: true, accountName: true, bankName: true },
  });

  const periodOptions: PeriodOption[] = periods.map((p) => ({ id: p.id, label: p.periodName }));
  const bankAccountOptions: BankAccountOption[] = bankAccounts.map((b) => ({ id: b.id, label: `${b.accountName} — ${b.bankName}` }));

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="text-2xl font-semibold text-foreground">لوحة الضرائب</h1>
      <p className="mt-1 text-sm text-muted-foreground">{records.length} إقرار مسجّل</p>

      {currentPeriod ? (
        <div className="mt-6 grid gap-4 rounded-xl border border-border bg-card p-5 sm:grid-cols-3">
          <div>
            <p className="text-xs text-muted-foreground">ض.ق.م مخرجات (فترة {currentPeriod.periodName})</p>
            <p className="mt-1 font-mono text-xl font-semibold text-foreground">{vatOutputBalance.toFixed(2)}</p>
            {!alreadyFiledOutput ? (
              <div className="mt-2">
                <ApproveVatButton periodId={currentPeriod.id} taxType="VATOutput" />
              </div>
            ) : (
              <p className="mt-2 text-xs text-emerald-700">اتقدّم ✓</p>
            )}
          </div>
          <div>
            <p className="text-xs text-muted-foreground">ض.ق.م مدخلات (فترة {currentPeriod.periodName})</p>
            <p className="mt-1 font-mono text-xl font-semibold text-foreground">{vatInputBalance.toFixed(2)}</p>
            {!alreadyFiledInput ? (
              <div className="mt-2">
                <ApproveVatButton periodId={currentPeriod.id} taxType="VATInput" />
              </div>
            ) : (
              <p className="mt-2 text-xs text-emerald-700">اتقدّم ✓</p>
            )}
          </div>
          <div className={`rounded-lg border p-3 ${netPayable.gte(0) ? "border-rose-300 bg-rose-50" : "border-emerald-300 bg-emerald-50"}`}>
            <p className="text-xs text-muted-foreground">{netPayable.gte(0) ? "صافي مستحق للمصلحة" : "صافي مسترد"}</p>
            <p className={`mt-1 font-mono text-xl font-semibold ${netPayable.gte(0) ? "text-rose-700" : "text-emerald-700"}`}>
              {netPayable.abs().toFixed(2)}
            </p>
          </div>
        </div>
      ) : (
        <p className="mt-6 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          مفيش فترة محاسبية مفتوحة — افتح فترة الأول من صفحة الفترات المحاسبية.
        </p>
      )}
      <p className="mt-2 text-xs text-muted-foreground">
        رصيد ض.ق.م محسوب من حسابي 1040/2030 مباشرة (مش إدخال يدوي) — مصدر الحقيقة الوحيد هو الدفتر.
      </p>

      <div className="mt-6">
        <ManualTaxRecordForm periods={periodOptions} />
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>النوع</TableHead>
              <TableHead>الفترة</TableHead>
              <TableHead>المبلغ</TableHead>
              <TableHead>الحالة</TableHead>
              <TableHead>مرجع ETA</TableHead>
              <TableHead>إجراء</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-6 text-center text-muted-foreground">
                  لسه مفيش إقرارات ضريبية.
                </TableCell>
              </TableRow>
            ) : (
              records.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-foreground/80">{taxTypeLabel[r.taxType]}</TableCell>
                  <TableCell className="text-foreground/80">{r.period.periodName}</TableCell>
                  <TableCell className="font-mono text-foreground">
                    {r.amount.toFixed(2)} {r.currency}
                  </TableCell>
                  <TableCell>
                    <Badge className={taxFilingStatusStyle[r.filingStatus]}>{taxFilingStatusLabel[r.filingStatus]}</Badge>
                  </TableCell>
                  <TableCell className="text-foreground/80">{r.etaReference ?? "—"}</TableCell>
                  <TableCell>
                    {r.filingStatus === "Filed" && (
                      <PayTaxButton
                        taxRecordId={r.id}
                        bankAccounts={bankAccountOptions}
                        needsFxRate={!!org.functionalCurrency && r.currency !== org.functionalCurrency}
                        currency={r.currency}
                        functionalCurrency={org.functionalCurrency ?? undefined}
                      />
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </main>
  );
}
