"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { getScopedPrisma, withScopedTransaction } from "@/lib/scoped-prisma";
import { requireCurrentUser } from "@/lib/session";
import { requirePermission } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { postFixedAssetAcquisition, runDepreciationForPeriod, postAssetDisposal, postTaxPayment, computeVatBalance } from "@/lib/accounting";
import { logError, isNextControlFlowError, businessRuleMessage } from "@/lib/errorLog";
import { isGlBackedTax } from "@/lib/treasuryLabels";

// ==================== Budget ====================

const BUDGET_TYPES = ["Sales", "Purchase", "OPEX", "CAPEX", "Cash"] as const;

const BudgetSchema = z.object({
  periodId: z.string().uuid("اختر فترة محاسبية"),
  budgetType: z.enum(BUDGET_TYPES),
  costCenterId: z.string().uuid().optional().or(z.literal("")),
  amount: z.coerce.number().positive("المبلغ مطلوب"),
  currency: z.string().trim().length(3).toUpperCase(),
});

export type BudgetFormState = { errors?: Record<string, string[]>; formError?: string };

export async function createBudget(_prevState: BudgetFormState, formData: FormData): Promise<BudgetFormState> {
  const parsed = BudgetSchema.safeParse({
    periodId: formData.get("periodId"),
    budgetType: formData.get("budgetType"),
    costCenterId: formData.get("costCenterId") || undefined,
    amount: formData.get("amount"),
    currency: formData.get("currency"),
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const user = await requireCurrentUser();
  const { periodId, budgetType, costCenterId, amount, currency } = parsed.data;

  try {
    await requirePermission(user.roleId, "Budget", "Create");
    // periodId إلزامي وبيتعرض بلا `?.` في `/accounting/budgets` (`b.period.periodName`) — لازم
    // يتحقق قبل الإنشاء (اتكشف في مراجعة وحدة 8، 6 سبتمبر).
    const scopedPrisma = await getScopedPrisma();
    const period = await scopedPrisma.accountingPeriod.findFirst({ where: { id: periodId } });
    if (!period) return { formError: "الفترة المحاسبية غير موجودة." };
    if (costCenterId) {
      const costCenter = await scopedPrisma.costCenter.findFirst({ where: { id: costCenterId } });
      if (!costCenter) return { formError: "مركز التكلفة غير موجود." };
    }
    await withScopedTransaction(async (tx) => {
      const budget = await tx.budget.create({
        data: { orgId: user.orgId, periodId, budgetType, costCenterId: costCenterId || undefined, amount: new Prisma.Decimal(amount), currency },
      });
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "budget.created",
        entityType: "Budget",
        entityId: budget.id,
        afterValue: { periodId, budgetType, amount: String(amount) },
      });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "createBudget", error: e });
    return { formError: businessRuleMessage(e, "حصل خطأ أثناء إضافة بند الموازنة — حاول تاني.") };
  }

  revalidatePath("/accounting/budgets");
  return {};
}

// ==================== FixedAsset ====================

const FIXED_ASSET_CATEGORIES = ["Equipment", "Vehicle", "Furniture", "Building", "ComputerHardware", "Other"] as const;

const FixedAssetSchema = z.object({
  nameAr: z.string().trim().min(1, "اسم الأصل مطلوب"),
  nameEn: z.string().trim().min(1, "الاسم الإنجليزي مطلوب"),
  category: z.enum(FIXED_ASSET_CATEGORIES),
  costCenterId: z.string().uuid().optional().or(z.literal("")),
  purchaseDate: z.string().trim().min(1, "تاريخ الشراء مطلوب"),
  purchaseValue: z.coerce.number().positive("قيمة الشراء مطلوبة"),
  currency: z.string().trim().length(3).toUpperCase(),
  usefulLifeMonths: z.coerce.number().int().positive("العمر الإنتاجي مطلوب (بالشهور)"),
});

export type FixedAssetFormState = { errors?: Record<string, string[]>; formError?: string; assetId?: string };

/** الترقيم `FA-{year}-{seq}` نفس نمط INV/PAY. الشراء بيترحّل تلقائيًا فور التسجيل (افتراض
 * شراء نقدي، نفس تبسيط صرف القرض) — من غيره التخلص من الأصل لاحقًا مالوش حساب يتشطب منه. */
export async function createFixedAsset(_prevState: FixedAssetFormState, formData: FormData): Promise<FixedAssetFormState> {
  const parsed = FixedAssetSchema.safeParse({
    nameAr: formData.get("nameAr"),
    nameEn: formData.get("nameEn"),
    category: formData.get("category"),
    costCenterId: formData.get("costCenterId") || undefined,
    purchaseDate: formData.get("purchaseDate"),
    purchaseValue: formData.get("purchaseValue"),
    currency: formData.get("currency"),
    usefulLifeMonths: formData.get("usefulLifeMonths"),
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const user = await requireCurrentUser();
  const { nameAr, nameEn, category, costCenterId, purchaseDate, purchaseValue, currency, usefulLifeMonths } = parsed.data;

  try {
    await requirePermission(user.roleId, "FixedAsset", "Create");
    const assetId = await withScopedTransaction(async (tx) => {
      const year = new Date(purchaseDate).getFullYear();
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`FA-${user.orgId}-${year}`}, 0))`;
      const countThisYear = await tx.fixedAsset.count({ where: { orgId: user.orgId, assetCode: { startsWith: `FA-${year}-` } } });
      const assetCode = `FA-${year}-${String(countThisYear + 1).padStart(4, "0")}`;

      const asset = await tx.fixedAsset.create({
        data: {
          orgId: user.orgId,
          assetCode,
          nameAr,
          nameEn,
          category,
          costCenterId: costCenterId || undefined,
          purchaseDate: new Date(purchaseDate),
          purchaseValue: new Prisma.Decimal(purchaseValue),
          currency,
          usefulLifeMonths,
        },
      });

      const journalEntryId = await postFixedAssetAcquisition(tx, asset, asset.purchaseDate, user.id);
      // netBookValue بيتصان بـTrigger عادةً من DepreciationEntry، لكن الأصل الجديد بلا إهلاك
      // لسه — بنضبطه هنا بس وقت الإنشاء (accumulatedDepreciation=0 دايمًا في هذه اللحظة).
      await tx.fixedAsset.update({ where: { id: asset.id }, data: { netBookValue: asset.purchaseValue } });

      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "fixedAsset.created",
        entityType: "FixedAsset",
        entityId: asset.id,
        afterValue: { assetCode, purchaseValue: String(purchaseValue), journalEntryId },
      });
      return asset.id;
    });

    revalidatePath("/accounting/fixed-assets");
    return { assetId };
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "createFixedAsset", error: e });
    return { formError: businessRuleMessage(e, "حصل خطأ أثناء تسجيل الأصل — حاول تاني.") };
  }
}

const DisposalSchema = z.object({
  disposalDate: z.string().trim().min(1, "تاريخ التخلص مطلوب"),
  disposalValue: z.coerce.number().min(0, "حصيلة البيع مطلوبة"),
});

export type DisposalFormState = { errors?: Record<string, string[]>; formError?: string };

/** التخلص من أصل: بيرحّل القيد الأول (شطب التكلفة + مجمّع الإهلاك + ربح/خسارة)، وبعدين بس
 * يأكّد الحالة — الـTrigger enforce_fixed_asset_disposal بيرفض التأكيد بلا القيد أصلًا. */
export async function disposeFixedAssetAction(assetId: string, _prevState: DisposalFormState, formData: FormData): Promise<DisposalFormState> {
  const parsed = DisposalSchema.safeParse({
    disposalDate: formData.get("disposalDate"),
    disposalValue: formData.get("disposalValue"),
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const user = await requireCurrentUser();
  const { disposalDate, disposalValue } = parsed.data;

  try {
    await requirePermission(user.roleId, "FixedAsset", "Edit");
    await withScopedTransaction(async (tx) => {
      const asset = await tx.fixedAsset.findUniqueOrThrow({ where: { id: assetId } });
      if (asset.status !== "Active") throw new Error(`الأصل ${asset.assetCode} حالته ${asset.status} — الأصول النشطة بس اللي تتباع.`);

      const disposalValueDec = new Prisma.Decimal(disposalValue);
      const journalEntryId = await postAssetDisposal(tx, asset, disposalValueDec, new Date(disposalDate), user.id);

      await tx.fixedAsset.update({
        where: { id: assetId },
        data: {
          status: "Disposed",
          disposalDate: new Date(disposalDate),
          disposalValue: disposalValueDec,
          disposalJournalEntryId: journalEntryId,
        },
      });

      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "fixedAsset.disposed",
        entityType: "FixedAsset",
        entityId: assetId,
        afterValue: { disposalValue: String(disposalValue), journalEntryId },
      });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "disposeFixedAssetAction", error: e });
    return { formError: businessRuleMessage(e, "حصل خطأ أثناء تسجيل التخلص من الأصل.") };
  }

  revalidatePath(`/accounting/fixed-assets/${assetId}`);
  revalidatePath("/accounting/fixed-assets");
  return {};
}

// ==================== Depreciation ====================

/** تشغيل الإهلاك الدوري لفترة معيّنة — قيد واحد مجمّع لكل الأصول النشطة، Idempotent
 * (الأصول اللي اتعمل لها إهلاك الفترة دي بالفعل بتتخطّى بصمت). */
export async function runDepreciationAction(periodId: string) {
  const user = await requireCurrentUser();
  await requirePermission(user.roleId, "DepreciationEntry", "Create");

  let result: { journalEntryId: string | null; postedCount: number; skippedCount: number };
  try {
    result = await withScopedTransaction(async (tx) => {
      const r = await runDepreciationForPeriod(tx, user.orgId, periodId, user.id);
      if (r.journalEntryId) {
        await logAudit(tx, {
          orgId: user.orgId,
          userId: user.id,
          action: "depreciation.run",
          entityType: "JournalEntry",
          entityId: r.journalEntryId,
          afterValue: { periodId, postedCount: r.postedCount, skippedCount: r.skippedCount },
        });
      }
      return r;
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "runDepreciationAction", error: e });
    throw new Error(businessRuleMessage(e, "حصل خطأ أثناء تشغيل الإهلاك."));
  }

  revalidatePath("/accounting/depreciation");
  revalidatePath("/accounting/fixed-assets");
  return result;
}

// ==================== TaxRecord ====================

const TAX_TYPES = ["VATOutput", "VATInput", "WithholdingTax", "PayrollTax"] as const;

const TaxRecordSchema = z.object({
  taxType: z.enum(TAX_TYPES),
  periodId: z.string().uuid("اختر فترة محاسبية"),
  amount: z.coerce.number().positive("المبلغ مطلوب"),
  currency: z.string().trim().length(3).toUpperCase(),
  etaReference: z.string().trim().optional().or(z.literal("")),
});

export type TaxRecordFormState = { errors?: Record<string, string[]>; formError?: string };

/** تسجيل يدوي — لأنواع الضريبة اللي مالهاش حساب GL مخصص (خصم منبع/مرتبات). ض.ق.م بتتسجّل
 * عبر approveVatFilingAction بدل كده (المبلغ محسوب من الدفتر مش مُدخَل). */
export async function createTaxRecord(_prevState: TaxRecordFormState, formData: FormData): Promise<TaxRecordFormState> {
  const parsed = TaxRecordSchema.safeParse({
    taxType: formData.get("taxType"),
    periodId: formData.get("periodId"),
    amount: formData.get("amount"),
    currency: formData.get("currency"),
    etaReference: formData.get("etaReference") || undefined,
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };
  if (isGlBackedTax(parsed.data.taxType)) {
    return { formError: "ض.ق.م بتتسجّل تلقائيًا من رصيد الدفتر — استخدم زرار الاعتماد في لوحة الضرائب بدل الإدخال اليدوي." };
  }

  const user = await requireCurrentUser();
  const { taxType, periodId, amount, currency, etaReference } = parsed.data;

  try {
    await requirePermission(user.roleId, "TaxRecord", "Create");
    // periodId إلزامي وبيتعرض بلا `?.` في `/accounting/tax-records` (`r.period.periodName`) —
    // لازم يتحقق قبل الإنشاء (اتكشف في مراجعة وحدة 8، 6 سبتمبر).
    const scopedPrisma = await getScopedPrisma();
    const period = await scopedPrisma.accountingPeriod.findFirst({ where: { id: periodId } });
    if (!period) return { formError: "الفترة المحاسبية غير موجودة." };
    await withScopedTransaction(async (tx) => {
      const record = await tx.taxRecord.create({
        data: { orgId: user.orgId, taxType, periodId, amount: new Prisma.Decimal(amount), currency, etaReference: etaReference || undefined },
      });
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "taxRecord.created",
        entityType: "TaxRecord",
        entityId: record.id,
        afterValue: { taxType, amount: String(amount) },
      });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "createTaxRecord", error: e });
    return { formError: businessRuleMessage(e, "حصل خطأ أثناء تسجيل الإقرار — حاول تاني.") };
  }

  revalidatePath("/accounting/tax-records");
  return {};
}

/** اعتماد إقرار ض.ق.م — المبلغ بيتحسب هنا داخل الـTransaction من `computeVatBalance()` مباشرة،
 * مش بيتاخد من الواجهة. ⚠️ إصلاح عيب حقيقي: النسخة الأولى كانت بتاخد المبلغ كـparameter من
 * المتصفح (نفس الرقم المعروض وقت التحميل) وتكتبه زي ما هو — أي فاصل زمني بين تحميل الصفحة
 * والضغط على الزرار (فاتورة جديدة اترحّلت في الأثناء) كان يخلّي الإقرار المسجَّل غلط، وده نفس
 * الفئة من الأخطاء اللي المشروع كله بيمنعها (مبلغ الفاتورة، الدفعة، الإهلاك — كلهم بيتحسبوا
 * جوه الـServer Action مش بياخدوا رقم جاهز من العميل). */
export async function approveVatFilingAction(periodId: string, taxType: "VATInput" | "VATOutput") {
  const user = await requireCurrentUser();
  await requirePermission(user.roleId, "TaxRecord", "Create");

  // ⚠️ العملة مثبَّتة EGP — ض.ق.م ضريبة محلية بطبيعتها، ونفس الفرض المتّبع في نماذج الحسابات
  // البنكية الافتراضية (defaultValue="EGP"). لو المنظومة احتاجت عملة تانية لاحقًا، الحقل جاهز.
  const currency = "EGP";
  try {
    await withScopedTransaction(async (tx) => {
      const { output, input } = await computeVatBalance(tx, user.orgId, periodId);
      const amountDec = taxType === "VATOutput" ? output : input;

      const record = await tx.taxRecord.create({
        data: {
          orgId: user.orgId,
          taxType,
          periodId,
          amount: amountDec,
          currency,
          filingStatus: "Filed",
          filingDate: new Date(),
        },
      });
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "taxRecord.vatFiled",
        entityType: "TaxRecord",
        entityId: record.id,
        afterValue: { taxType, amount: amountDec.toString() },
      });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "approveVatFilingAction", error: e });
    throw new Error(businessRuleMessage(e, "حصل خطأ أثناء اعتماد الإقرار."));
  }

  revalidatePath("/accounting/tax-records");
}

const TaxPaymentSchema = z.object({ bankAccountId: z.string().uuid("اختر حساب بنكي"), paymentDate: z.string().trim().min(1, "تاريخ السداد مطلوب") });

export type TaxPaymentFormState = { errors?: Record<string, string[]>; formError?: string };

/** سداد إقرار ضريبي — بينشئ دفعة صادرة حقيقية (محصّلة فورًا) + قيد مرحّل، ثم يعلّم الإقرار
 * "مسدَّد". نفس علاج LoanInstallment.status=Paid: السداد حدث نقدي حقيقي، مش تغيير حالة. */
export async function payTaxRecordAction(taxRecordId: string, _prevState: TaxPaymentFormState, formData: FormData): Promise<TaxPaymentFormState> {
  const parsed = TaxPaymentSchema.safeParse({
    bankAccountId: formData.get("bankAccountId"),
    paymentDate: formData.get("paymentDate"),
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const user = await requireCurrentUser();
  const { bankAccountId, paymentDate } = parsed.data;

  try {
    await requirePermission(user.roleId, "TaxRecord", "Edit");
    await withScopedTransaction(async (tx) => {
      const record = await tx.taxRecord.findUniqueOrThrow({ where: { id: taxRecordId } });
      if (record.filingStatus === "Paid") throw new Error("الإقرار ده مسدَّد بالفعل.");
      if (record.filingStatus === "NotFiled") throw new Error("لازم يتقدم الإقرار الأول قبل السداد.");

      const paidAt = new Date(paymentDate);
      const year = paidAt.getFullYear();
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`PAY-${user.orgId}-${year}`}, 0))`;
      const countThisYear = await tx.payment.count({ where: { orgId: user.orgId, paymentNumber: { startsWith: `PAY-${year}-` } } });
      const paymentNumber = `PAY-${year}-${String(countThisYear + 1).padStart(5, "0")}`;

      const journalEntryId = await postTaxPayment(tx, record, paidAt, user.id);

      const payment = await tx.payment.create({
        data: {
          orgId: user.orgId,
          paymentNumber,
          direction: "Outbound",
          bankAccountId,
          amount: record.amount,
          currency: record.currency,
          paymentMethod: "BankTransfer",
          paymentDate: paidAt,
          reference: `سداد إقرار ${record.taxType}`,
          status: "Cleared",
          createdBy: user.id,
          approvedBy: user.id,
        },
      });

      await tx.bankTransaction.create({
        data: {
          orgId: user.orgId,
          bankAccountId,
          transactionDate: paidAt,
          amount: record.amount,
          currency: record.currency,
          transactionType: "Withdrawal",
          reference: paymentNumber,
          description: `سداد إقرار ${record.taxType}`,
          paymentId: payment.id,
          journalEntryId,
        },
      });

      await tx.taxRecord.update({ where: { id: taxRecordId }, data: { filingStatus: "Paid", paymentId: payment.id } });

      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "taxRecord.paid",
        entityType: "TaxRecord",
        entityId: taxRecordId,
        afterValue: { paymentNumber, journalEntryId },
      });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "payTaxRecordAction", error: e });
    return { formError: businessRuleMessage(e, "حصل خطأ أثناء تسجيل السداد.") };
  }

  revalidatePath("/accounting/tax-records");
  revalidatePath("/accounting/payments");
  return {};
}
