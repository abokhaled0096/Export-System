import { Prisma } from "@/generated/prisma/client";
import type { ScopedTx } from "@/lib/scoped-prisma";
import { postJournalEntry, resolveAccountIds, type PostingLine } from "./accounting";

/**
 * إعادة تقييم فروق العملة غير المحقَّقة (Unrealized FX Revaluation) — بند مكمّل لفرق العملة
 * المحقَّق في postPaymentAllocated (src/lib/accounting.ts): ده بيغطّي الفواتير المفتوحة (لسه
 * مالهاش تحصيل/سداد كامل) اللي لسه قائمة بعملة أجنبية آخر الفترة — لازم تُعاد ترجمتها لسعر
 * الصرف الحالي عشان الميزانية تعكس القيمة الحقيقية دلوقتي، مش سعر الإصدار القديم.
 *
 * مقيَّد بـAR/AP بس (مش أي حساب بنكي بعملة أجنبية — ده محتاج دعم حسابات بنكية متعددة العملات
 * مش مبني لسه، حد موثّق صراحةً هنا).
 *
 * Idempotent على مستوى الفترة: لو الفترة دي اتعمل لها إعادة تقييم بالفعل (JournalEntry بـ
 * sourceModule=FXRevaluation)، الدالة بترفض تعمل واحدة تانية — نفس فلسفة runDepreciationForPeriod
 * (فعل صريح لمرة واحدة لكل فترة، مش تلقائي). لتصحيح رقم غلط: قيد عكسي (reverseJournalEntry) على
 * القيد القديم، بعدين تشغيل تاني.
 */
export async function revalueForeignCurrencyReceivablesPayables(
  tx: ScopedTx,
  orgId: string,
  periodId: string,
  preparedBy: string
): Promise<{ journalEntryId: string | null; revaluedInvoiceCount: number; skippedNoRateCount: number }> {
  const [org, period] = await Promise.all([
    tx.organization.findUniqueOrThrow({ where: { id: orgId }, select: { functionalCurrency: true } }),
    tx.accountingPeriod.findUniqueOrThrow({ where: { id: periodId } }),
  ]);
  if (!org.functionalCurrency) {
    throw new Error("لازم تفعّل عملة وظيفية للمنظمة (Organization.functionalCurrency) الأول — إعادة التقييم مش متاحة بلاها.");
  }

  const existing = await tx.journalEntry.findFirst({ where: { orgId, periodId, sourceModule: "FXRevaluation" } });
  if (existing) {
    throw new Error(`الفترة "${period.periodName}" اتعمل لها إعادة تقييم فروق عملة بالفعل (${existing.entryNumber}) — لو محتاج تصحيح، اعمل قيد عكسي عليه الأول.`);
  }

  const acc = await resolveAccountIds(tx, orgId, ["AR", "AP", "FX_GAIN_LOSS"]);

  const [openSalesInvoices, openPurchaseInvoices] = await Promise.all([
    tx.invoice.findMany({
      where: { orgId, invoiceType: "SalesInvoice", currency: { not: org.functionalCurrency }, status: { notIn: ["Draft", "Cancelled", "Paid"] }, journalEntryId: { not: null }, issueDate: { lte: period.endDate } },
    }),
    tx.invoice.findMany({
      where: { orgId, invoiceType: "PurchaseInvoice", currency: { not: org.functionalCurrency }, status: { notIn: ["Draft", "Cancelled", "Paid"] }, journalEntryId: { not: null }, issueDate: { lte: period.endDate } },
    }),
  ]);

  let arDelta = new Prisma.Decimal(0);
  let apDelta = new Prisma.Decimal(0);
  let revaluedInvoiceCount = 0;
  let skippedNoRateCount = 0;

  for (const [invoices, accountId, isAr] of [
    [openSalesInvoices, acc.AR, true],
    [openPurchaseInvoices, acc.AP, false],
  ] as const) {
    for (const invoice of invoices) {
      const remaining = invoice.totalAmount.sub(invoice.amountPaid);
      if (remaining.lte(0)) continue;

      const currentRate = await tx.exchangeRate.findFirst({
        where: { orgId, baseCurrency: invoice.currency, quoteCurrency: org.functionalCurrency, rateDate: { lte: period.endDate } },
        orderBy: { rateDate: "desc" },
      });
      if (!currentRate) {
        skippedNoRateCount++;
        continue;
      }

      const originalLine = await tx.journalLine.findFirst({ where: { journalEntryId: invoice.journalEntryId!, accountId } });
      if (!originalLine) continue;
      const originalRatio = isAr ? originalLine.functionalDebit.div(originalLine.debit) : originalLine.functionalCredit.div(originalLine.credit);

      const oldFunctional = remaining.mul(originalRatio);
      const newFunctional = remaining.mul(currentRate.rate);
      const delta = newFunctional.sub(oldFunctional);
      if (delta.eq(0)) continue;

      if (isAr) arDelta = arDelta.add(delta);
      else apDelta = apDelta.add(delta);
      revaluedInvoiceCount++;
    }
  }

  if (revaluedInvoiceCount === 0) return { journalEntryId: null, revaluedInvoiceCount: 0, skippedNoRateCount };

  const netGainLoss = arDelta.sub(apDelta);
  const description = `إعادة تقييم فروق عملة غير محقَّقة — فترة ${period.periodName}`;
  const lines: PostingLine[] = [];
  if (!arDelta.eq(0)) {
    lines.push(
      arDelta.gt(0)
        ? { accountId: acc.AR, debit: arDelta, currency: org.functionalCurrency, description: `${description} (ذمم مدينة)` }
        : { accountId: acc.AR, credit: arDelta.neg(), currency: org.functionalCurrency, description: `${description} (ذمم مدينة)` }
    );
  }
  if (!apDelta.eq(0)) {
    lines.push(
      apDelta.gt(0)
        ? { accountId: acc.AP, credit: apDelta, currency: org.functionalCurrency, description: `${description} (ذمم دائنة)` }
        : { accountId: acc.AP, debit: apDelta.neg(), currency: org.functionalCurrency, description: `${description} (ذمم دائنة)` }
    );
  }
  if (!netGainLoss.eq(0)) {
    lines.push(
      netGainLoss.gt(0)
        ? { accountId: acc.FX_GAIN_LOSS, credit: netGainLoss, currency: org.functionalCurrency, description: `${description} — ربح صافي` }
        : { accountId: acc.FX_GAIN_LOSS, debit: netGainLoss.neg(), currency: org.functionalCurrency, description: `${description} — خسارة صافية` }
    );
  }

  const journalEntryId = await postJournalEntry(tx, {
    orgId,
    entryDate: period.endDate,
    periodId,
    sourceType: "Automatic",
    sourceModule: "FXRevaluation",
    description,
    preparedBy,
    lines,
  });

  return { journalEntryId, revaluedInvoiceCount, skippedNoRateCount };
}
