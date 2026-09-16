import Link from "next/link";
import { requireCurrentUser } from "@/lib/session";
import { requirePermission } from "@/lib/permissions";
import { getScopedPrisma } from "@/lib/scoped-prisma";
import RunFxRevaluationButton from "./RunFxRevaluationButton";

export const dynamic = "force-dynamic";

type Search = Promise<{ period?: string }>;

export default async function FxRevaluationPage({ searchParams }: { searchParams: Search }) {
  const { period: selectedPeriodId } = await searchParams;
  const user = await requireCurrentUser();

  try {
    await requirePermission(user.roleId, "FXRevaluation", "Create");
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

  const org = await prisma.organization.findUniqueOrThrow({ where: { id: orgId }, select: { functionalCurrency: true } });
  if (!org.functionalCurrency) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="text-2xl font-semibold text-foreground">إعادة تقييم فروق العملة</h1>
        <p className="mt-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          الميزة دي محتاجة عملة وظيفية مفعّلة للمنظمة الأول —{" "}
          <Link href="/admin/accounting-settings" className="text-primary hover:underline">
            فعّلها من إعدادات المحاسبة
          </Link>
          .
        </p>
      </main>
    );
  }

  const periods = await prisma.accountingPeriod.findMany({
    where: { orgId, status: "Open" },
    orderBy: { startDate: "desc" },
    select: { id: true, periodName: true, startDate: true, endDate: true },
  });

  const period = periods.find((p) => p.id === selectedPeriodId) ?? periods[0];

  if (!period) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-10">
        <h1 className="text-2xl font-semibold text-foreground">إعادة تقييم فروق العملة</h1>
        <p className="mt-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          مفيش فترة محاسبية مفتوحة — افتح فترة الأول من صفحة الفترات المحاسبية.
        </p>
      </main>
    );
  }

  const existingRevaluation = await prisma.journalEntry.findFirst({
    where: { orgId, periodId: period.id, sourceModule: "FXRevaluation" },
    select: { id: true, entryNumber: true },
  });

  const openForeignInvoices = await prisma.invoice.count({
    where: { orgId, currency: { not: org.functionalCurrency }, status: { notIn: ["Draft", "Cancelled", "Paid"] }, journalEntryId: { not: null }, issueDate: { lte: period.endDate } },
  });

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <div className="flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">إعادة تقييم فروق العملة</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            فترة {period.periodName} — العملة الوظيفية {org.functionalCurrency} — {openForeignInvoices} فاتورة مفتوحة بعملة أجنبية
          </p>
        </div>
      </div>

      <p className="mt-4 rounded-lg bg-sky-50 px-3 py-2 text-xs text-sky-800">
        بيُعيد ترجمة الفواتير المفتوحة (المدين والدائنة) بعملة أجنبية لسعر الصرف الحالي — الفرق عن سعر
        الإصدار الأصلي بيترحّل كفرق عملة غير محقَّق. الفرق المحقَّق فعليًا (وقت التحصيل/السداد الفعلي)
        بيتحسب تلقائيًا في نفس اللحظة من صفحة الدفعة نفسها، مش هنا.
      </p>

      {periods.length > 1 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {periods.map((p) => (
            <Link
              key={p.id}
              href={`/accounting/fx-revaluation?period=${p.id}`}
              className={`rounded-lg border px-3 py-1.5 text-sm ${
                p.id === period.id ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-secondary"
              }`}
            >
              {p.periodName}
            </Link>
          ))}
        </div>
      )}

      <div className="mt-6">
        {existingRevaluation ? (
          <p className="text-sm text-muted-foreground">
            اتعمل إعادة تقييم للفترة دي بالفعل —{" "}
            <Link href={`/accounting/journal-entries/${existingRevaluation.id}`} className="font-mono text-primary hover:underline">
              {existingRevaluation.entryNumber}
            </Link>
            . لتصحيح رقم غلط، اعمل قيد عكسي عليه الأول.
          </p>
        ) : (
          <RunFxRevaluationButton periodId={period.id} />
        )}
      </div>
    </main>
  );
}
