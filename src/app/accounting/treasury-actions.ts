"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { withScopedTransaction, getScopedPrisma } from "@/lib/scoped-prisma";
import { requireCurrentUser } from "@/lib/session";
import { requirePermission } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { postBankTransaction, postLoanDisbursement, postLoanInstallmentPaid, isPostableBankTransaction, resolveFxRateId } from "@/lib/accounting";
import { logError, isNextControlFlowError, businessRuleMessage, isIdempotencyKeyConflict } from "@/lib/errorLog";
import { requireAal2 } from "@/lib/mfa";
import { parseCsv, deterministicUuid } from "@/lib/csv";
import { bankTransactionTypeLabel, isInflow } from "@/lib/treasuryLabels";
import { generateAmortizationSchedule } from "@/lib/loanAmortization";
import { currencySchema } from "@/lib/currencySchema";
import { businessYear } from "@/lib/format";

// ==================== BankTransaction ====================

const TRANSACTION_TYPES = ["Deposit", "Withdrawal", "TransferIn", "TransferOut", "Charge", "Interest"] as const;

const BankTransactionSchema = z.object({
  transactionDate: z.string().trim().min(1, "تاريخ الحركة مطلوب"),
  amount: z.coerce.number().positive("المبلغ لازم يكون أكبر من صفر"),
  transactionType: z.enum(TRANSACTION_TYPES, "اختار نوع حركة صحيح"),
  reference: z.string().trim().optional().or(z.literal("")),
  description: z.string().trim().optional().or(z.literal("")),
  idempotencyKey: z.string().uuid().optional().or(z.literal("")),
  fxRate: z.string().trim().optional().or(z.literal("")),
});

export type BankTransactionFormState = { errors?: Record<string, string[]>; formError?: string };

/** الحركة بتاخد عملة الحساب تلقائيًا (مش إدخال) — والـTrigger بيتأكد من ده على مستوى القاعدة.
 * المصروفات والفوائد بتترحّل فورًا؛ الإيداع/السحب لأ، لأنهم بيقابلوا دفعة مرحّلة أصلًا. */
export async function createBankTransaction(
  bankAccountId: string,
  _prevState: BankTransactionFormState,
  formData: FormData
): Promise<BankTransactionFormState> {
  const parsed = BankTransactionSchema.safeParse({
    transactionDate: formData.get("transactionDate"),
    amount: formData.get("amount"),
    transactionType: formData.get("transactionType"),
    reference: formData.get("reference") || undefined,
    description: formData.get("description") || undefined,
    idempotencyKey: formData.get("idempotencyKey") || undefined,
    fxRate: formData.get("fxRate") || undefined,
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const user = await requireCurrentUser();
  const { transactionDate, amount, transactionType, reference, description, idempotencyKey, fxRate } = parsed.data;

  try {
    await requirePermission(user.roleId, "BankTransaction", "Create");

    // الفحص بعد الصلاحية عمدًا مش قبلها — مستخدم بلا BankTransaction.Create مايشوفش حتى إن السجل موجود.
    if (idempotencyKey) {
      const scopedPrisma = await getScopedPrisma();
      const existing = await scopedPrisma.bankTransaction.findFirst({ where: { orgId: user.orgId, idempotencyKey }, select: { id: true } });
      if (existing) return {};
    }

    await withScopedTransaction(async (tx) => {
      const account = await tx.bankAccount.findUniqueOrThrow({ where: { id: bankAccountId }, select: { currency: true } });

      const transaction = await tx.bankTransaction.create({
        data: {
          orgId: user.orgId,
          bankAccountId,
          transactionDate: new Date(transactionDate),
          amount: new Prisma.Decimal(amount),
          currency: account.currency,
          transactionType,
          reference: reference || undefined,
          description: description || undefined,
          idempotencyKey: idempotencyKey || undefined,
        },
      });

      // المصروف/الفائدة حدث محاسبي مستقل — لازم يوصل للدفتر وإلا الدفتر عمره ما هيعرف بيه.
      if (isPostableBankTransaction(transactionType)) {
        const fxRateId = await resolveFxRateId(tx, user.orgId, account.currency, transaction.transactionDate, fxRate || undefined);
        const journalEntryId = await postBankTransaction(tx, { ...transaction, fxRateId }, user.id);
        await tx.bankTransaction.update({ where: { id: transaction.id }, data: { journalEntryId } });
      }

      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "bankTransaction.created",
        entityType: "BankTransaction",
        entityId: transaction.id,
        afterValue: { transactionType, amount: String(amount), currency: account.currency },
      });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    if (idempotencyKey && isIdempotencyKeyConflict(e)) return {};
    await logError({ orgId: user.orgId, userId: user.id, action: "createBankTransaction", error: e });
    return { formError: businessRuleMessage(e, "حصل خطأ أثناء تسجيل الحركة — حاول تاني.") };
  }

  revalidatePath(`/accounting/bank-accounts/${bankAccountId}`);
  return {};
}

/** مضاهاة حركة بنكية بدفعة مسجَّلة — جوهر المطابقة البنكية. الـTrigger بيتأكد إن الدفعة نفس
 * الحساب ونفس العملة ونفس المبلغ، فمفيش تحقق مكرر هنا. */
export async function matchTransactionToPaymentAction(transactionId: string, paymentId: string | null) {
  const user = await requireCurrentUser();
  await requirePermission(user.roleId, "BankReconciliation", "Edit");

  let bankAccountId = "";
  try {
    await withScopedTransaction(async (tx) => {
      const transaction = await tx.bankTransaction.findUniqueOrThrow({ where: { id: transactionId } });
      bankAccountId = transaction.bankAccountId;

      await tx.bankTransaction.update({ where: { id: transactionId }, data: { paymentId } });
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: paymentId ? "bankTransaction.matched" : "bankTransaction.unmatched",
        entityType: "BankTransaction",
        entityId: transactionId,
        afterValue: { paymentId },
      });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "matchTransactionToPaymentAction", error: e });
    throw new Error(businessRuleMessage(e, "حصل خطأ أثناء المضاهاة."));
  }

  revalidatePath(`/accounting/bank-accounts/${bankAccountId}`);
  revalidatePath("/accounting/reconciliations");
}

/** مضاهاة جزئية/متعددة (حركة واحدة بتقابل عدة دفعات، أو العكس) — نفس نمط PaymentAllocation.
 * مستقلة عن matchTransactionToPaymentAction (المسار السريع 1:1 بكامل المبلغ) — التريجر
 * بيمنع استخدام الاتنين مع بعض على نفس الحركة. */
export async function addBankTransactionMatchAction(transactionId: string, paymentId: string, allocatedAmount: string) {
  const user = await requireCurrentUser();
  await requirePermission(user.roleId, "BankReconciliation", "Edit");

  const amount = Number(allocatedAmount);
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("مبلغ المضاهاة لازم يكون رقم أكبر من صفر.");

  let bankAccountId = "";
  try {
    await withScopedTransaction(async (tx) => {
      const transaction = await tx.bankTransaction.findUniqueOrThrow({ where: { id: transactionId } });
      bankAccountId = transaction.bankAccountId;

      const match = await tx.bankTransactionMatch.create({
        data: { orgId: user.orgId, bankTransactionId: transactionId, paymentId, allocatedAmount: new Prisma.Decimal(amount) },
      });
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "bankTransaction.partiallyMatched",
        entityType: "BankTransactionMatch",
        entityId: match.id,
        afterValue: { transactionId, paymentId, allocatedAmount: amount },
      });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "addBankTransactionMatchAction", error: e });
    throw new Error(businessRuleMessage(e, "حصل خطأ أثناء المضاهاة الجزئية."));
  }

  revalidatePath(`/accounting/bank-accounts/${bankAccountId}`);
  revalidatePath("/accounting/reconciliations");
}

/** إلغاء مضاهاة جزئية واحدة — نفس منطق deletePaymentAllocationAction (حذف مباشر، مفيش
 * أثر مالي معتمد يمنعه لأن المضاهاة البنكية نفسها بلا قيد محاسبي مستقل). */
export async function removeBankTransactionMatchAction(matchId: string) {
  const user = await requireCurrentUser();
  await requirePermission(user.roleId, "BankReconciliation", "Edit");

  let bankAccountId = "";
  try {
    await withScopedTransaction(async (tx) => {
      const match = await tx.bankTransactionMatch.findUniqueOrThrow({
        where: { id: matchId },
        include: { bankTransaction: { select: { bankAccountId: true } } },
      });
      bankAccountId = match.bankTransaction.bankAccountId;

      await tx.bankTransactionMatch.delete({ where: { id: matchId } });
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "bankTransaction.partialMatchRemoved",
        entityType: "BankTransactionMatch",
        entityId: matchId,
      });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "removeBankTransactionMatchAction", error: e });
    throw new Error(businessRuleMessage(e, "حصل خطأ أثناء إلغاء المضاهاة."));
  }

  revalidatePath(`/accounting/bank-accounts/${bankAccountId}`);
  revalidatePath("/accounting/reconciliations");
}

// ==================== استيراد كشف حساب بنكي (CSV) ====================
//
// معاملات مالية حقيقية بالجملة — أعلى درجة حماية متاحة في المشروع لعملية استيراد:
// (1) MFA (aal2) إلزامي على الخطوتين (المعاينة والتأكيد) — نفس قاعدة "بيانات بنكية" في CLAUDE.md،
//     ومطبَّق هنا بمعزل بسبب حجم الأثر المالي، مش لأن الحركة نفسها "بيانات بنكية" بالتعريف الحرفي.
// (2) صلاحية مخصوصة `BankTransaction.Import` منفصلة عن `BankTransaction.Create` العادي — استيراد
//     بالجملة خطر مختلف عن إدخال حركة واحدة، فمينفعش يتفتح لكل حد عنده صلاحية الإدخال اليدوي.
// (3) خطوتين إلزاميتين: معاينة (بلا أي كتابة في القاعدة) ثم تأكيد صريح — المستخدم بيشوف بالظبط
//     عدد الحركات وصافي المبلغ وارد/صادر قبل أي التزام، مش استيراد أعمى زي `importProductsCsv`.
// (4) Idempotency حتمي لكل صف (هاش من الحساب+التاريخ+المبلغ+النوع+المرجع+البيان) — نفس الملف
//     يتاستورد مرتين بلا تكرار، وملفين متداخلين (شهر ونص شهر) بياخدوا الصفوف المشتركة مرة واحدة بس.
// (5) مضاهاة تلقائية بدفعة محتاجة تطابق كامل (حساب+عملة+مبلغ، الـTrigger بيتأكد منه) + اتجاه صحيح
//     (وارد↔Inbound، صادر↔Outbound — الـTrigger مبيتحققش من الاتجاه، فده طبقة حماية إضافية هنا)
//     + عدم وجود أكتر من مرشّح واحد وعدم وجود مرشّح متاستخدم بالفعل — لو فيه لبس، تتسيب من غير مضاهاة
//     للمراجعة اليدوية بدل ما نخمّن غلط في بيانات مالية.

const MAX_STATEMENT_IMPORT_ROWS = 1000;

const BANK_TRANSACTION_TYPE_LABEL_TO_KEY: Record<string, string> = Object.fromEntries(
  Object.entries(bankTransactionTypeLabel).map(([key, label]) => [label, key])
);

// صيغة ISO صريحة (YYYY-MM-DD) بس — لو سبنا new Date() تفهم أي صيغة، "01/02/2026" هتتفسّر
// غلط بصمت (يناير 2 ولا فبراير 1؟) حسب الـlocale، وده تاريخ حركة بنكية حقيقي مش حاجة نخمّن فيها.
const StatementCsvRowSchema = z.object({
  transactionDate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "التاريخ لازم يكون بصيغة YYYY-MM-DD بالظبط")
    .refine((v) => !Number.isNaN(new Date(v).getTime()), "تاريخ غير صالح"),
  amount: z.coerce.number().positive("المبلغ لازم يكون أكبر من صفر"),
  transactionType: z
    .string()
    .trim()
    .transform((label) => BANK_TRANSACTION_TYPE_LABEL_TO_KEY[label])
    .refine((key): key is string => key !== undefined, "نوع الحركة لازم يكون واحد من: " + Object.values(bankTransactionTypeLabel).join("، ")),
  reference: z.string().trim().optional(),
  description: z.string().trim().optional(),
});

/** صف جاهز للتنفيذ — كل حقوله اتفحصت وقت المعاينة، بس بيتفحص تاني وقت التأكيد (مايتوثقش في مدخلات العميل). */
type ConfirmableRow = {
  transactionDate: string;
  amount: number;
  transactionType: string;
  reference?: string;
  description?: string;
  idempotencyKey: string;
  matchedPaymentId: string | null;
};

const ConfirmableRowSchema = z.object({
  transactionDate: z.string().trim().refine((v) => !Number.isNaN(new Date(v).getTime())),
  amount: z.coerce.number().positive("لازم يكون أكبر من صفر"),
  transactionType: z.enum(TRANSACTION_TYPES, "اختار نوع حركة صحيح"),
  reference: z.string().trim().optional(),
  description: z.string().trim().optional(),
  idempotencyKey: z.string().uuid(),
  matchedPaymentId: z.string().uuid().nullable(),
});

export type StatementImportPreviewRow = {
  row: number;
  transactionDate: string;
  amount: string;
  transactionType: string;
  reference?: string;
  description?: string;
  status: "سيتم استيراده" | "مكرر — متسجّل قبل كده" | "مضاهى تلقائيًا بدفعة";
  matchedPaymentNumber?: string;
};

export type StatementImportPreviewState = {
  formError?: string;
  mfaRequired?: boolean;
  preview?: {
    rows: StatementImportPreviewRow[];
    rowErrors: { row: number; message: string }[];
    toCreateCount: number;
    duplicateCount: number;
    autoMatchedCount: number;
    inflowTotal: string;
    outflowTotal: string;
    currency: string;
    payload: string;
  };
};

/** الخطوة 1: بلا أي كتابة في القاعدة — قراءة وفحص وحساب أثر الاستيراد بس. */
export async function previewBankStatementImportAction(
  bankAccountId: string,
  _prevState: StatementImportPreviewState,
  formData: FormData
): Promise<StatementImportPreviewState> {
  const user = await requireCurrentUser();
  try {
    await requirePermission(user.roleId, "BankTransaction", "Import");
  } catch {
    return { formError: "معندكش صلاحية استيراد كشف حساب بنكي." };
  }
  try {
    await requireAal2();
  } catch {
    return { formError: "استيراد كشف حساب بنكي محتاج تحقق بخطوتين (MFA) الأول.", mfaRequired: true };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { formError: "لازم تختار ملف CSV." };

  const text = await file.text();
  const { data, errors: parseErrors } = parseCsv(text);
  if (parseErrors.length > 0) return { formError: `الملف فيه مشكلة تنسيق: ${parseErrors[0]}` };
  if (data.length === 0) return { formError: "الملف فاضي — لازم يكون فيه سطر عناوين وسطر بيانات على الأقل." };
  if (data.length > MAX_STATEMENT_IMPORT_ROWS) {
    return { formError: `الملف فيه ${data.length} صف — الحد الأقصى ${MAX_STATEMENT_IMPORT_ROWS} صف لكل استيراد.` };
  }

  const scopedPrisma = await getScopedPrisma();
  const account = await scopedPrisma.bankAccount.findFirst({ where: { id: bankAccountId, orgId: user.orgId }, select: { id: true, currency: true } });
  if (!account) return { formError: "الحساب البنكي مش موجود." };

  const rowErrors: { row: number; message: string }[] = [];
  const validRows: { row: number; data: z.infer<typeof StatementCsvRowSchema>; idempotencyKey: string }[] = [];
  // صفين متطابقين تمامًا (نفس التاريخ/المبلغ/النوع/المرجع/البيان) هيولّدوا نفس الـhash — سيناريو
  // حقيقي وارد جدًا في كشوف الحساب (رسوم متطابقة، سحوبات نقطية بمبلغ مقفول، بلا مرجع مميّز).
  // لازم نفرّق بينهم برقم تكرار حتمي (0 للأول، 1 للتاني...) — وإلا التاني هيتحسب "مكرر" غلط
  // وقت المعاينة، وأسوأ من كده: لو الاتنين عدّوا (معندهمش تطابق مسبق في القاعدة)، محاولة إدخال
  // الاتنين بنفس idempotencyKey في التأكيد هترجع الـtransaction كلها بسبب قيد unique في القاعدة.
  const occurrenceCount = new Map<string, number>();

  for (let i = 0; i < data.length; i++) {
    const raw = data[i];
    const parsed = StatementCsvRowSchema.safeParse({
      transactionDate: raw["التاريخ"],
      amount: raw["المبلغ"],
      transactionType: raw["نوع الحركة"],
      reference: raw["المرجع"] || undefined,
      description: raw["البيان"] || undefined,
    });
    if (!parsed.success) {
      rowErrors.push({ row: i + 2, message: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" });
      continue;
    }
    // transactionDate بقى مضمون YYYY-MM-DD بالـregex فوق — بلا حاجة لأي تطبيع إضافي.
    const baseKeyParts = [
      bankAccountId,
      parsed.data.transactionDate,
      parsed.data.amount.toFixed(2),
      parsed.data.transactionType,
      parsed.data.reference ?? "",
      parsed.data.description ?? "",
    ];
    const occurrence = occurrenceCount.get(baseKeyParts.join("|")) ?? 0;
    occurrenceCount.set(baseKeyParts.join("|"), occurrence + 1);
    const idempotencyKey = deterministicUuid([...baseKeyParts, String(occurrence)]);
    validRows.push({ row: i + 2, data: parsed.data, idempotencyKey });
  }

  // فحص المكرّر بالجملة (استعلام واحد) بدل واحد لكل صف — مهم لملفات لحد 1000 صف.
  const existingKeys = validRows.length
    ? new Set(
        (
          await scopedPrisma.bankTransaction.findMany({
            where: { orgId: user.orgId, bankAccountId, idempotencyKey: { in: validRows.map((r) => r.idempotencyKey) } },
            select: { idempotencyKey: true },
          })
        ).map((t) => t.idempotencyKey)
      )
    : new Set<string | null>();

  const newRows = validRows.filter((r) => !existingKeys.has(r.idempotencyKey));

  // مرشّحو المضاهاة: دفعات نفس الحساب/العملة، حالتها Pending أو Cleared، ومش مربوطة بحركة موجودة بالفعل.
  const alreadyLinked = new Set(
    (
      await scopedPrisma.bankTransaction.findMany({
        where: { orgId: user.orgId, bankAccountId, paymentId: { not: null } },
        select: { paymentId: true },
      })
    ).map((t) => t.paymentId!)
  );
  const candidatePayments = await scopedPrisma.payment.findMany({
    where: { orgId: user.orgId, bankAccountId, currency: account.currency, status: { in: ["Pending", "Cleared"] } },
    select: { id: true, amount: true, direction: true, paymentNumber: true },
  });
  const availableByAmount = new Map<string, typeof candidatePayments>();
  for (const p of candidatePayments) {
    if (alreadyLinked.has(p.id)) continue;
    const key = `${p.direction}:${p.amount.toFixed(2)}`;
    availableByAmount.set(key, [...(availableByAmount.get(key) ?? []), p]);
  }

  let inflowTotal = new Prisma.Decimal(0);
  let outflowTotal = new Prisma.Decimal(0);
  let autoMatchedCount = 0;
  const previewRows: StatementImportPreviewRow[] = [];
  const confirmableRows: ConfirmableRow[] = [];

  for (const r of newRows) {
    let matchedPaymentId: string | null = null;
    let matchedPaymentNumber: string | undefined;
    // المصروف البنكي/الفائدة بيترحّلوا كحدث محاسبي مستقل (isPostableBankTransaction) ومينفعش
    // يتربطوا بدفعة أصلًا (postBankTransaction بترفض ده) — استبعادهم من المضاهاة هنا عمدًا،
    // وإلا تطابق مبلغ عرضي مع دفعة مفتوحة كان هيدّي مضاهاة غلط تمامًا في بيانات مالية.
    const direction = isInflow(r.data.transactionType) ? "Inbound" : "Outbound";
    const key = `${direction}:${r.data.amount.toFixed(2)}`;
    const candidates = isPostableBankTransaction(r.data.transactionType) ? [] : (availableByAmount.get(key) ?? []);
    if (candidates.length === 1) {
      matchedPaymentId = candidates[0].id;
      matchedPaymentNumber = candidates[0].paymentNumber;
      availableByAmount.set(key, []); // اتاستهلك — منع صف تاني بنفس المبلغ يضاهي نفس الدفعة
      autoMatchedCount++;
    }

    if (isInflow(r.data.transactionType)) inflowTotal = inflowTotal.add(r.data.amount);
    else outflowTotal = outflowTotal.add(r.data.amount);

    previewRows.push({
      row: r.row,
      transactionDate: r.data.transactionDate,
      amount: r.data.amount.toFixed(2),
      transactionType: bankTransactionTypeLabel[r.data.transactionType],
      reference: r.data.reference,
      description: r.data.description,
      status: matchedPaymentId ? "مضاهى تلقائيًا بدفعة" : "سيتم استيراده",
      matchedPaymentNumber,
    });
    confirmableRows.push({
      transactionDate: r.data.transactionDate,
      amount: r.data.amount,
      transactionType: r.data.transactionType,
      reference: r.data.reference,
      description: r.data.description,
      idempotencyKey: r.idempotencyKey,
      matchedPaymentId,
    });
  }

  for (const r of validRows.filter((r) => existingKeys.has(r.idempotencyKey))) {
    previewRows.push({
      row: r.row,
      transactionDate: r.data.transactionDate,
      amount: r.data.amount.toFixed(2),
      transactionType: bankTransactionTypeLabel[r.data.transactionType],
      reference: r.data.reference,
      description: r.data.description,
      status: "مكرر — متسجّل قبل كده",
    });
  }
  previewRows.sort((a, b) => a.row - b.row);

  return {
    preview: {
      rows: previewRows,
      rowErrors,
      toCreateCount: confirmableRows.length,
      duplicateCount: validRows.length - newRows.length,
      autoMatchedCount,
      inflowTotal: inflowTotal.toFixed(2),
      outflowTotal: outflowTotal.toFixed(2),
      currency: account.currency,
      payload: JSON.stringify(confirmableRows),
    },
  };
}

export type StatementImportConfirmState = {
  formError?: string;
  mfaRequired?: boolean;
  summary?: { created: number; autoMatched: number; skippedAsDuplicate: number };
};

/** الخطوة 2: التزام فعلي — كل شيء في transaction واحدة (كله ينجح أو كله يترجع، مفيش استيراد جزئي). */
export async function confirmBankStatementImportAction(
  bankAccountId: string,
  _prevState: StatementImportConfirmState,
  formData: FormData
): Promise<StatementImportConfirmState> {
  const user = await requireCurrentUser();
  try {
    await requirePermission(user.roleId, "BankTransaction", "Import");
  } catch {
    return { formError: "معندكش صلاحية استيراد كشف حساب بنكي." };
  }
  try {
    await requireAal2();
  } catch {
    return { formError: "استيراد كشف حساب بنكي محتاج تحقق بخطوتين (MFA) الأول.", mfaRequired: true };
  }

  const payloadRaw = formData.get("payload");
  if (typeof payloadRaw !== "string" || !payloadRaw) return { formError: "بيانات المعاينة مفقودة — ابدأ الاستيراد من الأول." };

  let rows: ConfirmableRow[];
  try {
    const arr = JSON.parse(payloadRaw);
    if (!Array.isArray(arr) || arr.length === 0) return { formError: "مفيش صفوف للاستيراد." };
    // إعادة فحص كاملة — مفيش أي ثقة في مدخلات العميل حتى لو جايه من نفس الفورم (defense in depth).
    rows = arr.map((r) => ConfirmableRowSchema.parse(r));
  } catch {
    return { formError: "بيانات المعاينة تالفة — ابدأ الاستيراد من الأول." };
  }
  if (rows.length > MAX_STATEMENT_IMPORT_ROWS) return { formError: "عدد الصفوف تجاوز الحد الأقصى." };

  let created = 0;
  let autoMatched = 0;
  let skippedAsDuplicate = 0;

  try {
    await withScopedTransaction(async (tx) => {
      const account = await tx.bankAccount.findUniqueOrThrow({ where: { id: bankAccountId }, select: { currency: true } });

      // إعادة فحص المكرّر لحظة التنفيذ (الوقت بين المعاينة والتأكيد ممكن يكون فيه استيراد تاني حصل).
      const existingKeys = new Set(
        (
          await tx.bankTransaction.findMany({
            where: { orgId: user.orgId, bankAccountId, idempotencyKey: { in: rows.map((r) => r.idempotencyKey) } },
            select: { idempotencyKey: true },
          })
        ).map((t) => t.idempotencyKey)
      );

      // إعادة فحص كل مضاهاة لحظة التنفيذ (defense in depth — الـpayload جاي من مدخلات عميل،
      // ومفيش ثقة إنه لسه صحيح بعد وقت المعاينة أو إنه ماتلعبش فيه). لازم تطابق كامل حساب/عملة/
      // مبلغ/اتجاه + الدفعة لسه Pending/Cleared ومش مربوطة بحركة تانية أصلًا + مش متستخدمة مرتين
      // في نفس الدفعة دي. أي مخالفة = تتسيب من غير مضاهاة (مش نرفض الاستيراد كله بسببها).
      const matchedIds = [...new Set(rows.map((r) => r.matchedPaymentId).filter((id): id is string => id !== null))];
      const validPayments = matchedIds.length
        ? new Map(
            (
              await tx.payment.findMany({
                where: { id: { in: matchedIds }, orgId: user.orgId, bankAccountId, currency: account.currency, status: { in: ["Pending", "Cleared"] } },
                select: { id: true, amount: true, direction: true },
              })
            ).map((p) => [p.id, p] as const)
          )
        : new Map<string, { id: string; amount: Prisma.Decimal; direction: string }>();
      const alreadyLinked = matchedIds.length
        ? new Set(
            (await tx.bankTransaction.findMany({ where: { orgId: user.orgId, paymentId: { in: matchedIds } }, select: { paymentId: true } })).map(
              (t) => t.paymentId!
            )
          )
        : new Set<string>();
      const usedInThisBatch = new Set<string>();

      for (const row of rows) {
        if (existingKeys.has(row.idempotencyKey)) {
          skippedAsDuplicate++;
          continue;
        }

        let paymentId: string | null = null;
        if (row.matchedPaymentId && !isPostableBankTransaction(row.transactionType) && !usedInThisBatch.has(row.matchedPaymentId)) {
          const payment = validPayments.get(row.matchedPaymentId);
          const expectedDirection = isInflow(row.transactionType) ? "Inbound" : "Outbound";
          if (payment && !alreadyLinked.has(payment.id) && payment.direction === expectedDirection && payment.amount.toFixed(2) === row.amount.toFixed(2)) {
            paymentId = payment.id;
            usedInThisBatch.add(payment.id);
          }
        }

        const transaction = await tx.bankTransaction.create({
          data: {
            orgId: user.orgId,
            bankAccountId,
            transactionDate: new Date(row.transactionDate),
            amount: new Prisma.Decimal(row.amount),
            currency: account.currency,
            transactionType: row.transactionType as (typeof TRANSACTION_TYPES)[number],
            reference: row.reference || undefined,
            description: row.description || undefined,
            idempotencyKey: row.idempotencyKey,
            paymentId: paymentId ?? undefined,
          },
        });
        created++;
        if (paymentId) autoMatched++;

        if (isPostableBankTransaction(row.transactionType)) {
          const journalEntryId = await postBankTransaction(tx, transaction, user.id);
          await tx.bankTransaction.update({ where: { id: transaction.id }, data: { journalEntryId } });
        }

        await logAudit(tx, {
          orgId: user.orgId,
          userId: user.id,
          action: "bankTransaction.created",
          entityType: "BankTransaction",
          entityId: transaction.id,
          afterValue: { transactionType: row.transactionType, amount: String(row.amount), currency: account.currency, source: "csv-import" },
        });
      }

      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "bankTransaction.csvImported",
        entityType: "BankAccount",
        entityId: bankAccountId,
        afterValue: { created, autoMatched, skippedAsDuplicate },
      });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "confirmBankStatementImportAction", error: e });
    return { formError: businessRuleMessage(e, "حصل خطأ أثناء الاستيراد — مفيش أي صف اتسجّل (الاستيراد كله في معاملة واحدة). حاول تاني.") };
  }

  revalidatePath(`/accounting/bank-accounts/${bankAccountId}`);
  revalidatePath("/accounting/reconciliations");
  return { summary: { created, autoMatched, skippedAsDuplicate } };
}

// ==================== BankReconciliation ====================

const ReconciliationSchema = z.object({
  bankAccountId: z.string().uuid("اختر حساب بنكي"),
  statementDate: z.string().trim().min(1, "تاريخ الكشف مطلوب"),
  statementBalance: z.coerce.number(),
  notes: z.string().trim().optional().or(z.literal("")),
});

export type ReconciliationFormState = { errors?: Record<string, string[]>; formError?: string; reconciliationId?: string };

/** ⚠️ `bookBalance` مش بيتبعت هنا إطلاقًا — عمود مصان بـTrigger بالكامل (رصيد افتتاحي +
 * الحركات لغاية تاريخ الكشف). ده انحراف واعٍ عن الـERD اللي بيحطه كحقل يدوي. */
export async function createReconciliation(
  _prevState: ReconciliationFormState,
  formData: FormData
): Promise<ReconciliationFormState> {
  const parsed = ReconciliationSchema.safeParse({
    bankAccountId: formData.get("bankAccountId"),
    statementDate: formData.get("statementDate"),
    statementBalance: formData.get("statementBalance"),
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const user = await requireCurrentUser();
  const { bankAccountId, statementDate, statementBalance, notes } = parsed.data;

  try {
    await requirePermission(user.roleId, "BankReconciliation", "Create");
    // bankAccountId إلزامي وبيتعرض بلا `?.` في `/accounting/reconciliations`/`reconciliations/[id]`
    // — لازم يتحقق قبل الإنشاء (اتكشف في مراجعة وحدة 8، 6 سبتمبر).
    const scopedPrisma = await getScopedPrisma();
    const bankAccount = await scopedPrisma.bankAccount.findFirst({ where: { id: bankAccountId } });
    if (!bankAccount) return { formError: "الحساب البنكي غير موجود." };
    const reconciliationId = await withScopedTransaction(async (tx) => {
      const reconciliation = await tx.bankReconciliation.create({
        data: {
          orgId: user.orgId,
          bankAccountId,
          statementDate: new Date(statementDate),
          statementBalance: new Prisma.Decimal(statementBalance),
          notes: notes || undefined,
        },
      });
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "bankReconciliation.created",
        entityType: "BankReconciliation",
        entityId: reconciliation.id,
        afterValue: { statementDate, statementBalance: String(statementBalance) },
      });
      return reconciliation.id;
    });

    revalidatePath("/accounting/reconciliations");
    return { reconciliationId };
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "createReconciliation", error: e });
    return { formError: businessRuleMessage(e, "حصل خطأ أثناء إنشاء المطابقة — حاول تاني.") };
  }
}

const UpdateReconciliationDetailsSchema = z.object({
  statementBalance: z.coerce.number({ error: "رصيد الكشف مطلوب" }),
  statementDate: z.string().trim().min(1, "تاريخ الكشف مطلوب"),
  notes: z.string().trim().optional().or(z.literal("")),
});

export type UpdateStatementBalanceFormState = { errors?: Record<string, string[]>; formError?: string; success?: boolean };

/** تصحيح رصيد/تاريخ الكشف قبل الإقفال — لو المستخدم غلط وقت النسخ من كشف ورقي/PDF. آمن طول ما
 * المطابقة لسه مفتوحة: الـTrigger enforce_reconciliation_closure (module8_slice3_treasury)
 * بيرفض أي تعديل على مطابقة status=Reconciled أصلًا (immutability)، فمفيش داعي لفحص مكرّر
 * هنا غير رسالة واضحة للمستخدم بدل ما يشوف خطأ القاعدة الخام. تعديل statementDate آمن كمان
 * بلا أي حساب إضافي هنا — Trigger sync_reconciliation_book_balance (نفس الشريحة) بيعيد حساب
 * bookBalance تلقائيًا حسب التاريخ الجديد على أي UPDATE، فمفيش داعي نكرر الحساب يدويًا (bookBalance
 * أصلًا محسوب من كل حركات الحساب لغاية التاريخ، مش من مجموعة الحركات "المضمومة" لهذه المطابقة —
 * compute_book_balance مبيتأثرش بـreconciliationId خالص). **لكن** لو التاريخ اتحرّك لقبل، أي حركة
 * كانت مضمومة (reconciliationId) وبقت بعد التاريخ الجديد لازم تتفك — وإلا هتفضل "مضمومة" فعليًا
 * في القاعدة بس مختفية من قائمة المرشّحين في الواجهة (الاستعلام في page.tsx بيفلتر بالتاريخ)،
 * تناقض صامت مش خطر مالي (bookBalance سليم برضه) لكن مربك ولازم يتصحّح. */
export async function updateReconciliationStatementBalanceAction(
  reconciliationId: string,
  _prevState: UpdateStatementBalanceFormState,
  formData: FormData
): Promise<UpdateStatementBalanceFormState> {
  const parsed = UpdateReconciliationDetailsSchema.safeParse({
    statementBalance: formData.get("statementBalance"),
    statementDate: formData.get("statementDate"),
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const user = await requireCurrentUser();
  try {
    await requirePermission(user.roleId, "BankReconciliation", "Edit");
    await withScopedTransaction(async (tx) => {
      const reconciliation = await tx.bankReconciliation.findUniqueOrThrow({ where: { id: reconciliationId } });
      if (reconciliation.status === "Reconciled") {
        throw new Error("المطابقة دي مقفولة بالفعل — سجل نهائي مايتعدّلش، افتح مطابقة جديدة لو فيه تصحيح.");
      }

      const newStatementDate = new Date(parsed.data.statementDate);
      await tx.bankReconciliation.update({
        where: { id: reconciliationId },
        data: {
          statementBalance: new Prisma.Decimal(parsed.data.statementBalance),
          statementDate: newStatementDate,
          // بلا || undefined عمدًا هنا (عكس الحقول المشفّرة) — الفورم ده بيتملّى بالقيمة الحالية
          // فعليًا (notes مش سرّي)، فحقل فاضي يعني المستخدم مسحه قصدًا، مش "سيبه زي ما هو".
          notes: parsed.data.notes || null,
        },
      });

      // فك أي حركة كانت مضمومة وبقت بعد التاريخ الجديد — راجع تعليق الدالة فوق.
      await tx.bankTransaction.updateMany({
        where: { reconciliationId, transactionDate: { gt: newStatementDate } },
        data: { reconciliationId: null },
      });

      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "bankReconciliation.detailsUpdated",
        entityType: "BankReconciliation",
        entityId: reconciliationId,
        beforeValue: {
          statementBalance: reconciliation.statementBalance.toString(),
          statementDate: reconciliation.statementDate.toISOString(),
          notes: reconciliation.notes,
        },
        afterValue: { statementBalance: parsed.data.statementBalance.toString(), statementDate: parsed.data.statementDate, notes: parsed.data.notes || null },
      });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "updateReconciliationStatementBalanceAction", error: e });
    return { formError: businessRuleMessage(e, "حصل خطأ أثناء تعديل رصيد الكشف — حاول تاني.") };
  }

  revalidatePath(`/accounting/reconciliations/${reconciliationId}`);
  return { success: true };
}

/** ضم/فك حركة من المطابقة. الـTrigger بيمنع ضم حركة من حساب تاني أو لمطابقة مقفولة. */
export async function toggleTransactionInReconciliationAction(reconciliationId: string, transactionId: string, include: boolean) {
  const user = await requireCurrentUser();
  await requirePermission(user.roleId, "BankReconciliation", "Edit");

  try {
    await withScopedTransaction(async (tx) => {
      await tx.bankTransaction.update({
        where: { id: transactionId },
        data: { reconciliationId: include ? reconciliationId : null },
      });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "toggleTransactionInReconciliationAction", error: e });
    throw new Error(businessRuleMessage(e, "حصل خطأ أثناء تعديل حركات المطابقة."));
  }

  revalidatePath(`/accounting/reconciliations/${reconciliationId}`);
}

/** إقفال المطابقة. ⚠️ الـTrigger بيرفض الإقفال لو `bookBalance ≠ statementBalance` — وده
 * الغرض الكامل للكيان، والمواصفة كانت سايباه بلا أي تحقق. */
export async function closeReconciliationAction(reconciliationId: string) {
  const user = await requireCurrentUser();
  await requirePermission(user.roleId, "BankReconciliation", "Edit");

  try {
    await withScopedTransaction(async (tx) => {
      await tx.bankReconciliation.update({
        where: { id: reconciliationId },
        data: { status: "Reconciled", reconciledBy: user.id, reconciledAt: new Date() },
      });
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "bankReconciliation.closed",
        entityType: "BankReconciliation",
        entityId: reconciliationId,
      });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "closeReconciliationAction", error: e });
    throw new Error(businessRuleMessage(e, "حصل خطأ أثناء إقفال المطابقة."));
  }

  revalidatePath(`/accounting/reconciliations/${reconciliationId}`);
  revalidatePath("/accounting/reconciliations");
}

// ==================== Loan ====================

const AMORTIZATION_METHODS = ["EqualInstallment", "EqualPrincipal"] as const;

const LoanSchema = z.object({
  lenderName: z.string().trim().min(1, "اسم الجهة المقرضة مطلوب"),
  bankAccountId: z.string().uuid("اختر الحساب اللي القرض هينزل فيه"),
  principal: z.coerce.number().positive("أصل القرض مطلوب"),
  interestRatePct: z.coerce.number().min(0, "لازم يكون 0 أو أكتر").optional(),
  numberOfInstallments: z.coerce.number().int().positive("لازم يكون رقم صحيح موجب").optional(),
  amortizationMethod: z.enum(AMORTIZATION_METHODS, "اختار طريقة تقسيط صحيحة").optional(),
  startDate: z.string().trim().min(1, "تاريخ البداية مطلوب"),
  maturityDate: z.string().trim().min(1, "تاريخ الاستحقاق مطلوب"),
  collateral: z.string().trim().optional().or(z.literal("")),
});

export type LoanFormState = { errors?: Record<string, string[]>; formError?: string; loanId?: string };

export async function createLoan(_prevState: LoanFormState, formData: FormData): Promise<LoanFormState> {
  const parsed = LoanSchema.safeParse({
    lenderName: formData.get("lenderName"),
    bankAccountId: formData.get("bankAccountId"),
    principal: formData.get("principal"),
    interestRatePct: formData.get("interestRatePct") || undefined,
    numberOfInstallments: formData.get("numberOfInstallments") || undefined,
    amortizationMethod: formData.get("amortizationMethod") || undefined,
    startDate: formData.get("startDate"),
    maturityDate: formData.get("maturityDate"),
    collateral: formData.get("collateral") || undefined,
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const user = await requireCurrentUser();
  const { bankAccountId, principal, interestRatePct, numberOfInstallments, amortizationMethod, startDate, maturityDate, collateral, lenderName } =
    parsed.data;

  if (new Date(maturityDate) <= new Date(startDate)) {
    return { errors: { maturityDate: ["تاريخ الاستحقاق لازم يكون بعد تاريخ البداية"] } };
  }

  try {
    await requirePermission(user.roleId, "Loan", "Create");
    const loanId = await withScopedTransaction(async (tx) => {
      const account = await tx.bankAccount.findUniqueOrThrow({ where: { id: bankAccountId }, select: { currency: true } });

      const loan = await tx.loan.create({
        data: {
          orgId: user.orgId,
          lenderName,
          bankAccountId,
          principal: new Prisma.Decimal(principal),
          // القرض قبل الصرف التزامه صفر — بيتحوّل لأصل القرض وقت الصرف الفعلي.
          outstandingPrincipal: new Prisma.Decimal(0),
          currency: account.currency,
          interestRatePct: interestRatePct !== undefined ? new Prisma.Decimal(interestRatePct) : undefined,
          numberOfInstallments,
          amortizationMethod,
          startDate: new Date(startDate),
          maturityDate: new Date(maturityDate),
          collateral: collateral || undefined,
        },
      });
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "loan.created",
        entityType: "Loan",
        entityId: loan.id,
        afterValue: { lenderName, principal: String(principal), currency: account.currency },
      });
      return loan.id;
    });

    revalidatePath("/accounting/loans");
    return { loanId };
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "createLoan", error: e });
    return { formError: businessRuleMessage(e, "حصل خطأ أثناء تسجيل القرض — حاول تاني.") };
  }
}

/** صرف القرض — بيرحّل القيد (مدين نقدية / دائن قروض دائنة) وبيسجّل حركة إيداع بنكية مقابلة. */
export async function disburseLoanAction(loanId: string, fxRate?: string) {
  const user = await requireCurrentUser();
  await requirePermission(user.roleId, "Loan", "Edit");

  try {
    await withScopedTransaction(async (tx) => {
      const loan = await tx.loan.findUniqueOrThrow({ where: { id: loanId } });
      if (loan.disbursedAt) throw new Error(`القرض من ${loan.lenderName} اتصرف بالفعل.`);

      const fxRateId = await resolveFxRateId(tx, user.orgId, loan.currency, loan.startDate, fxRate || undefined);
      const journalEntryId = await postLoanDisbursement(tx, { ...loan, fxRateId }, user.id);

      // ⚠️ الحركة البنكية دي متربطتش بـPayment عمدًا — القرض مش تحصيل من عميل ولا سداد لمورّد،
      // فترحيله بيحصل هنا مرة واحدة والحركة سجل بنكي بس (journalEntryId بيوثّق الرابط).
      await tx.bankTransaction.create({
        data: {
          orgId: user.orgId,
          bankAccountId: loan.bankAccountId,
          transactionDate: loan.startDate,
          amount: loan.principal,
          currency: loan.currency,
          transactionType: "Deposit",
          reference: `LOAN-${loan.lenderName}`,
          description: `صرف قرض — ${loan.lenderName}`,
          journalEntryId,
        },
      });

      await tx.loan.update({
        where: { id: loanId },
        data: { disbursedAt: new Date(), journalEntryId, outstandingPrincipal: loan.principal },
      });

      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "loan.disbursed",
        entityType: "Loan",
        entityId: loanId,
        afterValue: { journalEntryId },
      });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "disburseLoanAction", error: e });
    throw new Error(businessRuleMessage(e, "حصل خطأ أثناء صرف القرض."));
  }

  revalidatePath(`/accounting/loans/${loanId}`);
  revalidatePath("/accounting/loans");
}

/** تحويل قرض قائم إلى متعثّر — حالة نهائية بلا مسار رجوع في الواجهة (نفس فلسفة "لا تعقيد
 * زيادة بلا سيناريو حقيقي" — لو ظهر احتياج فعلي لإلغاء التصنيف لاحقًا، `docs/ERD.md` والـTrigger
 * `sync_loan_outstanding` بيسمحوا بيه أصلًا، الـSchema/Trigger مش عائق). الـTrigger بيحترم
 * الحالة دي ومبيرجّعهاش Settled حتى لو الأصل المتبقي وصل صفر — `Defaulted` نهائي عمدًا. */
export async function markLoanDefaultedAction(loanId: string) {
  const user = await requireCurrentUser();
  await requirePermission(user.roleId, "Loan", "Edit");

  try {
    await withScopedTransaction(async (tx) => {
      const loan = await tx.loan.findUniqueOrThrow({ where: { id: loanId } });
      if (!loan.disbursedAt) throw new Error(`القرض من ${loan.lenderName} لسه متصرفش — مينفعش يتصنّف متعثّر قبل الصرف.`);
      if (loan.status !== "Active") throw new Error(`القرض من ${loan.lenderName} حالته ${loan.status} — القائم بس هو اللي يتحوّل متعثّر.`);

      await tx.loan.update({ where: { id: loanId }, data: { status: "Defaulted" } });

      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "loan.defaulted",
        entityType: "Loan",
        entityId: loanId,
        beforeValue: { status: loan.status },
        afterValue: { status: "Defaulted" },
      });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "markLoanDefaultedAction", error: e });
    throw new Error(businessRuleMessage(e, "حصل خطأ أثناء تصنيف القرض كمتعثّر."));
  }

  revalidatePath(`/accounting/loans/${loanId}`);
  revalidatePath("/accounting/loans");
}

const InstallmentSchema = z.object({
  dueDate: z.string().trim().min(1, "تاريخ الاستحقاق مطلوب"),
  principalPortion: z.coerce.number().min(0, "حصة الأصل مطلوبة"),
  interestPortion: z.coerce.number().min(0, "لازم يكون 0 أو أكتر").optional(),
});

export type InstallmentFormState = { errors?: Record<string, string[]>; formError?: string };

export async function createLoanInstallment(
  loanId: string,
  _prevState: InstallmentFormState,
  formData: FormData
): Promise<InstallmentFormState> {
  const parsed = InstallmentSchema.safeParse({
    dueDate: formData.get("dueDate"),
    principalPortion: formData.get("principalPortion"),
    interestPortion: formData.get("interestPortion") || undefined,
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const user = await requireCurrentUser();
  const { dueDate, principalPortion, interestPortion } = parsed.data;

  try {
    await requirePermission(user.roleId, "Loan", "Edit");
    await withScopedTransaction(async (tx) => {
      const installment = await tx.loanInstallment.create({
        data: {
          orgId: user.orgId,
          loanId,
          dueDate: new Date(dueDate),
          principalPortion: new Prisma.Decimal(principalPortion),
          interestPortion: new Prisma.Decimal(interestPortion ?? 0),
        },
      });
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "loanInstallment.created",
        entityType: "LoanInstallment",
        entityId: installment.id,
        afterValue: { dueDate, principalPortion: String(principalPortion) },
      });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "createLoanInstallment", error: e });
    return { formError: businessRuleMessage(e, "حصل خطأ أثناء إضافة القسط — حاول تاني.") };
  }

  revalidatePath(`/accounting/loans/${loanId}`);
  return {};
}

/**
 * توليد جدول أقساط تلقائي كامل — بند من BACKLOG.md § وحدة 8 ("جدولة أقساط القروض يدوية
 * بالكامل"). متاح بس لو القرض عنده `numberOfInstallments`/`amortizationMethod` محدَّدين وقت
 * الإنشاء (راجع `src/lib/loanAmortization.ts` للصيغة). Idempotent بمعنى "مرة واحدة بس" — لو
 * فيه أي قسط مسجَّل بالفعل (يدوي أو من توليد سابق)، بيترفض بدل ما يضاعف الجدول؛ لتصحيح جدول
 * غلط، لازم تتشال الأقساط الحالية الأول (نفس فلسفة runDepreciationForPeriod لكل فترة).
 */
export async function generateLoanScheduleAction(loanId: string) {
  const user = await requireCurrentUser();
  await requirePermission(user.roleId, "Loan", "Edit");

  try {
    await withScopedTransaction(async (tx) => {
      const loan = await tx.loan.findUniqueOrThrow({ where: { id: loanId }, include: { installments: { select: { id: true } } } });
      if (loan.installments.length > 0) {
        throw new Error(`القرض من ${loan.lenderName} عنده أقساط مسجَّلة بالفعل — الجدول التلقائي متاح للقروض اللي مفيهاش أي قسط لسه بس.`);
      }
      if (!loan.numberOfInstallments || !loan.amortizationMethod) {
        throw new Error(`القرض من ${loan.lenderName} مفيهوش عدد أقساط وطريقة تقسيط محدَّدين — الجدول التلقائي مش متاح، سجّل الأقساط يدويًا.`);
      }

      const schedule = generateAmortizationSchedule({
        principal: Number(loan.principal),
        interestRatePct: Number(loan.interestRatePct ?? 0),
        numberOfInstallments: loan.numberOfInstallments,
        method: loan.amortizationMethod,
        startDate: loan.startDate,
      });

      for (const line of schedule) {
        const installment = await tx.loanInstallment.create({
          data: {
            orgId: user.orgId,
            loanId,
            dueDate: line.dueDate,
            principalPortion: new Prisma.Decimal(line.principalPortion),
            interestPortion: new Prisma.Decimal(line.interestPortion),
          },
        });
        await logAudit(tx, {
          orgId: user.orgId,
          userId: user.id,
          action: "loanInstallment.autoGenerated",
          entityType: "LoanInstallment",
          entityId: installment.id,
          afterValue: { dueDate: line.dueDate, principalPortion: String(line.principalPortion), interestPortion: String(line.interestPortion) },
        });
      }
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "generateLoanScheduleAction", error: e });
    throw new Error(businessRuleMessage(e, "حصل خطأ أثناء توليد جدول الأقساط."));
  }

  revalidatePath(`/accounting/loans/${loanId}`);
}

/**
 * سداد قسط — بينشئ `Payment` صادر حقيقي (محصّل) + حركة بنكية + قيد مرحّل.
 * ⚠️ ده علاج عيب أساسي في المواصفة: `LoanInstallment.status = Paid` كان مجرد تغيير حالة
 * بلا أي حركة نقدية — فلوس "اتدفعت" مخرجتش من أي حساب ومظهرتش في الدفتر.
 */
export async function payLoanInstallmentAction(installmentId: string, fxRate?: string) {
  const user = await requireCurrentUser();
  await requirePermission(user.roleId, "Loan", "Edit");

  let loanId = "";
  try {
    await withScopedTransaction(async (tx) => {
      const installment = await tx.loanInstallment.findUniqueOrThrow({
        where: { id: installmentId },
        include: { loan: true },
      });
      loanId = installment.loanId;

      if (installment.status === "Paid") throw new Error("القسط ده مسدَّد بالفعل.");
      if (!installment.loan.disbursedAt) throw new Error("مينفعش سداد قسط لقرض لسه متصرفش.");

      const paidAt = new Date();
      const total = installment.principalPortion.add(installment.interestPortion);

      // ترقيم الدفعة بنفس نمط createPayment (advisory lock ضد التزامن).
      const year = businessYear(paidAt);
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`PAY-${user.orgId}-${year}`}, 0))`;
      const countThisYear = await tx.payment.count({ where: { orgId: user.orgId, paymentNumber: { startsWith: `PAY-${year}-` } } });
      const paymentNumber = `PAY-${year}-${String(countThisYear + 1).padStart(5, "0")}`;

      const fxRateId = await resolveFxRateId(tx, user.orgId, installment.loan.currency, paidAt, fxRate || undefined);
      const journalEntryId = await postLoanInstallmentPaid(
        tx,
        installment,
        installment.loan.currency,
        installment.loan.lenderName,
        paidAt,
        user.id,
        fxRateId
      );

      // الدفعة بتتسجّل Cleared فورًا — سداد القسط حدث نقدي تم فعلًا، مش نية دفع.
      // journalEntryId متربطش بالدفعة عشان postPaymentCleared ما يترحّلش تاني على نفس الحدث.
      const payment = await tx.payment.create({
        data: {
          orgId: user.orgId,
          paymentNumber,
          direction: "Outbound",
          bankAccountId: installment.loan.bankAccountId,
          amount: total,
          currency: installment.loan.currency,
          paymentMethod: "BankTransfer",
          paymentDate: paidAt,
          reference: `قسط قرض — ${installment.loan.lenderName}`,
          status: "Cleared",
          createdBy: user.id,
          approvedBy: user.id,
        },
      });

      await tx.bankTransaction.create({
        data: {
          orgId: user.orgId,
          bankAccountId: installment.loan.bankAccountId,
          transactionDate: paidAt,
          amount: total,
          currency: installment.loan.currency,
          transactionType: "Withdrawal",
          reference: paymentNumber,
          description: `سداد قسط قرض — ${installment.loan.lenderName}`,
          paymentId: payment.id,
          journalEntryId,
        },
      });

      await tx.loanInstallment.update({
        where: { id: installmentId },
        data: { status: "Paid", paidAt, paymentId: payment.id, journalEntryId },
      });

      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "loanInstallment.paid",
        entityType: "LoanInstallment",
        entityId: installmentId,
        afterValue: { paymentNumber, journalEntryId, total: total.toString() },
      });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "payLoanInstallmentAction", error: e });
    throw new Error(businessRuleMessage(e, "حصل خطأ أثناء سداد القسط."));
  }

  revalidatePath(`/accounting/loans/${loanId}`);
  revalidatePath("/accounting/loans");
  revalidatePath("/accounting/payments");
}

// ==================== CashFlowForecastLine ====================

const CASH_FLOW_CATEGORIES = [
  "CustomerCollections",
  "SupplierPayments",
  "Payroll",
  "Freight",
  "Customs",
  "Taxes",
  "LoanService",
  "Capex",
] as const;

const CashFlowLineSchema = z.object({
  weekStartDate: z.string().trim().min(1, "الأسبوع مطلوب"),
  category: z.enum(CASH_FLOW_CATEGORIES, "اختار فئة تدفّق نقدي صحيحة"),
  amount: z.coerce.number(),
  currency: currencySchema,
  notes: z.string().trim().optional().or(z.literal("")),
  costCenterId: z.string().trim().optional().or(z.literal("")),
  profitCenterId: z.string().trim().optional().or(z.literal("")),
});

export type CashFlowLineFormState = { errors?: Record<string, string[]>; formError?: string };

/** توقّع يدوي لأسبوع/فئة. `upsert` عشان التعديل يستبدل مش يكرّر (الـ@@unique بيحمي كمان).
 * ⚠️ مفيش `isActual` — الفعلي بيتحسب من الدفعات المحصّلة وقت العرض، ما بيتكتبش. */
export async function upsertCashFlowLine(
  _prevState: CashFlowLineFormState,
  formData: FormData
): Promise<CashFlowLineFormState> {
  const parsed = CashFlowLineSchema.safeParse({
    weekStartDate: formData.get("weekStartDate"),
    category: formData.get("category"),
    amount: formData.get("amount"),
    currency: formData.get("currency"),
    notes: formData.get("notes") || undefined,
    costCenterId: formData.get("costCenterId") || undefined,
    profitCenterId: formData.get("profitCenterId") || undefined,
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const user = await requireCurrentUser();
  const { weekStartDate, category, amount, currency, notes, costCenterId, profitCenterId } = parsed.data;

  try {
    await requirePermission(user.roleId, "CashFlowForecastLine", "Create");
    await withScopedTransaction(async (tx) => {
      // مفيش upsert بمفتاح مركّب هنا — costCenterId/profitCenterId nullable، وPrisma
      // مش بيسمح بـnull جوه شكل الـcompound unique lookup (بحث بمساواة مع NULL
      // مبيطابقش حاجة أصلًا في SQL). findFirst بيقبل null عادي كفلتر، فبنستخدمه
      // للتحقق يدويًا قبل create/update.
      const existing = await tx.cashFlowForecastLine.findFirst({
        where: {
          orgId: user.orgId,
          weekStartDate: new Date(weekStartDate),
          category,
          currency,
          costCenterId: costCenterId || null,
          profitCenterId: profitCenterId || null,
        },
        select: { id: true },
      });
      if (existing) {
        await tx.cashFlowForecastLine.update({
          where: { id: existing.id },
          data: { amount: new Prisma.Decimal(amount), notes: notes || undefined },
        });
      } else {
        await tx.cashFlowForecastLine.create({
          data: {
            orgId: user.orgId,
            weekStartDate: new Date(weekStartDate),
            category,
            amount: new Prisma.Decimal(amount),
            currency,
            notes: notes || undefined,
            costCenterId: costCenterId || undefined,
            profitCenterId: profitCenterId || undefined,
          },
        });
      }
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "upsertCashFlowLine", error: e });
    return { formError: businessRuleMessage(e, "حصل خطأ أثناء حفظ التوقّع — حاول تاني.") };
  }

  revalidatePath("/accounting/cash-flow");
  return {};
}
