"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getScopedPrisma, withScopedTransaction } from "@/lib/scoped-prisma";
import { requireCurrentUser } from "@/lib/session";
import { requirePermission } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { createJournalEntryDraft, postJournalEntryById, reverseJournalEntry } from "@/lib/accounting";
import { logError, isNextControlFlowError, businessRuleMessage } from "@/lib/errorLog";
import { assertWorkflowTransitionAllowed } from "@/lib/workflow";

const ACCOUNT_TYPES = ["Asset", "Liability", "Equity", "Revenue", "COGS", "Expense"] as const;
const NORMAL_BALANCES = ["Debit", "Credit"] as const;

const ChartOfAccountSchema = z.object({
  accountCode: z.string().trim().min(1, "كود الحساب مطلوب"),
  nameAr: z.string().trim().min(1, "الاسم بالعربي مطلوب"),
  nameEn: z.string().trim().min(1, "الاسم بالإنجليزي مطلوب"),
  accountType: z.enum(ACCOUNT_TYPES, "اختار نوع حساب صحيح"),
  normalBalance: z.enum(NORMAL_BALANCES, "اختار طبيعة رصيد صحيحة"),
  parentAccountId: z.string().uuid().optional().or(z.literal("")),
  currency: z.string().trim().length(3, "لازم 3 حروف (ISO 4217)").toUpperCase().optional().or(z.literal("")),
});

export type ChartOfAccountFormState = { errors?: Record<string, string[]>; formError?: string };

export async function createChartOfAccount(_prevState: ChartOfAccountFormState, formData: FormData): Promise<ChartOfAccountFormState> {
  const parsed = ChartOfAccountSchema.safeParse({
    accountCode: formData.get("accountCode"),
    nameAr: formData.get("nameAr"),
    nameEn: formData.get("nameEn"),
    accountType: formData.get("accountType"),
    normalBalance: formData.get("normalBalance"),
    parentAccountId: formData.get("parentAccountId") || undefined,
    currency: formData.get("currency") || undefined,
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const user = await requireCurrentUser();
  const { parentAccountId, currency, ...rest } = parsed.data;
  try {
    await requirePermission(user.roleId, "ChartOfAccount", "Create");
    // parentAccountId اختياري جاي من الفورم — لازم يتأكد إنه فعلًا بتاع نفس المنظمة قبل الإنشاء
    // (اتكشف في إعادة مراجعة وحدة 8، 7 سبتمبر).
    if (parentAccountId) {
      const scopedPrisma = await getScopedPrisma();
      const parentAccount = await scopedPrisma.chartOfAccount.findFirst({ where: { id: parentAccountId } });
      if (!parentAccount) return { formError: "الحساب الأب غير موجود." };
    }
    await withScopedTransaction(async (tx) => {
      const account = await tx.chartOfAccount.create({
        data: { orgId: user.orgId, parentAccountId: parentAccountId || undefined, currency: currency || undefined, ...rest },
      });
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "chartOfAccount.created",
        entityType: "ChartOfAccount",
        entityId: account.id,
        afterValue: { parentAccountId: parentAccountId || null, ...rest },
      });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "createChartOfAccount", error: e });
    return { formError: "حصل خطأ أثناء إضافة الحساب — حاول تاني (لو الكود مكرّر، جرّب كود مختلف)." };
  }

  revalidatePath("/accounting/chart-of-accounts");
  return {};
}

const ChartOfAccountEditSchema = z.object({
  nameAr: z.string().trim().min(1, "الاسم بالعربي مطلوب"),
  nameEn: z.string().trim().min(1, "الاسم بالإنجليزي مطلوب"),
});

export type ChartOfAccountEditFormState = { errors?: Record<string, string[]>; formError?: string; success?: boolean };

/** تعديل عام — الاسمين بس. عمدًا مش `accountCode`/`accountType`/`normalBalance`/`currency`/
 * `parentAccountId`: `accountCode` مفتاح ثابت مستخدم في `GL_ACCOUNTS` (كود مكتوب في المحرك نفسه،
 * مش بحث ديناميكي)، والباقي بنية الشجرة وطبيعة الرصيد اللي كل قيد مرحّل بالفعل مبني عليها —
 * تغييرهم بعد أي ترحيل هيخلّي القيود القديمة غير متّسقة مع تصنيف الحساب الجديد بصمت. */
export async function updateChartOfAccountAction(
  accountId: string,
  _prevState: ChartOfAccountEditFormState,
  formData: FormData
): Promise<ChartOfAccountEditFormState> {
  const parsed = ChartOfAccountEditSchema.safeParse({ nameAr: formData.get("nameAr"), nameEn: formData.get("nameEn") });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const user = await requireCurrentUser();
  try {
    await requirePermission(user.roleId, "ChartOfAccount", "Edit");
    await withScopedTransaction(async (tx) => {
      const before = await tx.chartOfAccount.findUniqueOrThrow({ where: { id: accountId }, select: { nameAr: true, nameEn: true } });
      await tx.chartOfAccount.update({ where: { id: accountId }, data: parsed.data });
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "chartOfAccount.updated",
        entityType: "ChartOfAccount",
        entityId: accountId,
        beforeValue: before,
        afterValue: parsed.data,
      });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "updateChartOfAccountAction", error: e });
    return { formError: businessRuleMessage(e, "حصل خطأ أثناء تعديل الحساب — حاول تاني.") };
  }

  revalidatePath("/accounting/chart-of-accounts");
  return { success: true };
}

/** تفعيل/إيقاف حساب — نفس نمط toggleBankAccountActiveAction، فعل منفصل بلا فورم. */
export async function toggleChartOfAccountActiveAction(accountId: string) {
  const user = await requireCurrentUser();
  await requirePermission(user.roleId, "ChartOfAccount", "Edit");

  try {
    await withScopedTransaction(async (tx) => {
      const account = await tx.chartOfAccount.findUniqueOrThrow({ where: { id: accountId }, select: { isActive: true } });
      await tx.chartOfAccount.update({ where: { id: accountId }, data: { isActive: !account.isActive } });
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "chartOfAccount.toggledActive",
        entityType: "ChartOfAccount",
        entityId: accountId,
        beforeValue: { isActive: account.isActive },
        afterValue: { isActive: !account.isActive },
      });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "toggleChartOfAccountActiveAction", error: e });
    throw new Error(businessRuleMessage(e, "حصل خطأ أثناء تحديث حالة الحساب."));
  }

  revalidatePath("/accounting/chart-of-accounts");
}

const AccountingPeriodSchema = z.object({
  periodName: z.string().trim().min(1, "اسم الفترة مطلوب"),
  startDate: z.string().trim().min(1, "تاريخ البداية مطلوب"),
  endDate: z.string().trim().min(1, "تاريخ النهاية مطلوب"),
});

export type AccountingPeriodFormState = { errors?: Record<string, string[]>; formError?: string };

export async function createAccountingPeriod(_prevState: AccountingPeriodFormState, formData: FormData): Promise<AccountingPeriodFormState> {
  const parsed = AccountingPeriodSchema.safeParse({
    periodName: formData.get("periodName"),
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const user = await requireCurrentUser();
  try {
    await requirePermission(user.roleId, "AccountingPeriod", "Create");
    await withScopedTransaction(async (tx) => {
      const period = await tx.accountingPeriod.create({
        data: {
          orgId: user.orgId,
          periodName: parsed.data.periodName,
          startDate: new Date(parsed.data.startDate),
          endDate: new Date(parsed.data.endDate),
        },
      });
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "accountingPeriod.created",
        entityType: "AccountingPeriod",
        entityId: period.id,
        afterValue: { ...parsed.data },
      });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "createAccountingPeriod", error: e });
    return { formError: "حصل خطأ أثناء إضافة الفترة — حاول تاني (لو الاسم مكرّر، جرّب اسم مختلف)." };
  }

  revalidatePath("/accounting/periods");
  return {};
}

const PERIOD_STATUSES = ["Open", "SoftClosed", "HardClosed"] as const;

/** ترقية حالة الفترة بس (Open→SoftClosed→HardClosed) — closedBy/closedAt بيتحدّدوا تلقائيًا لما
 * الحالة توصل HardClosed. بلا مسار تراجع (نفس فلسفة إقفال الفترات المحاسبية الحقيقي) — كان ده نية
 * الكود من الأول لكن بلا إنفاذ فعلي (الدالة كانت بتقبل أي نقلة بما فيها HardClosed→Open بلا فحص
 * خالص)؛ اتصلح بـ`assertWorkflowTransitionAllowed` (مراجعة وحدة 8، 7 سبتمبر) — راجع BACKLOG.md. */
export async function advanceAccountingPeriodStatus(periodId: string, nextStatus: (typeof PERIOD_STATUSES)[number]) {
  const parsed = z.enum(PERIOD_STATUSES, "اختار حالة فترة صحيحة").safeParse(nextStatus);
  if (!parsed.success) throw new Error("حالة فترة غير صالحة.");

  const user = await requireCurrentUser();
  await requirePermission(user.roleId, "AccountingPeriod", "Edit");

  try {
    await withScopedTransaction(async (tx) => {
      const period = await tx.accountingPeriod.findUniqueOrThrow({ where: { id: periodId } });
      if (period.status !== parsed.data) {
        await assertWorkflowTransitionAllowed(tx, user.orgId, "AccountingPeriod", periodId, period.status, parsed.data);
      }

      await tx.accountingPeriod.update({
        where: { id: periodId },
        data: {
          status: parsed.data,
          closedBy: parsed.data === "HardClosed" ? user.id : undefined,
          closedAt: parsed.data === "HardClosed" ? new Date() : undefined,
        },
      });
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "accountingPeriod.statusChanged",
        entityType: "AccountingPeriod",
        entityId: periodId,
        beforeValue: { status: period.status },
        afterValue: { status: parsed.data },
      });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "advanceAccountingPeriodStatus", error: e });
    throw new Error(businessRuleMessage(e, "حصل خطأ أثناء تحديث حالة الفترة — حاول تاني."));
  }

  revalidatePath("/accounting/periods");
}

const COST_CENTER_TYPES = ["Department", "Product", "Customer", "Deal", "Market"] as const;

const CostCenterSchema = z.object({
  code: z.string().trim().min(1, "الكود مطلوب"),
  name: z.string().trim().min(1, "الاسم مطلوب"),
  type: z.enum(COST_CENTER_TYPES, "اختار نوع مركز تكلفة صحيح"),
});

export type CostCenterFormState = { errors?: Record<string, string[]>; formError?: string };

export async function createCostCenter(_prevState: CostCenterFormState, formData: FormData): Promise<CostCenterFormState> {
  const parsed = CostCenterSchema.safeParse({
    code: formData.get("code"),
    name: formData.get("name"),
    type: formData.get("type"),
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const user = await requireCurrentUser();
  try {
    await requirePermission(user.roleId, "CostCenter", "Create");
    await withScopedTransaction(async (tx) => {
      const cc = await tx.costCenter.create({ data: { orgId: user.orgId, ...parsed.data } });
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "costCenter.created",
        entityType: "CostCenter",
        entityId: cc.id,
        afterValue: { ...parsed.data },
      });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "createCostCenter", error: e });
    return { formError: "حصل خطأ أثناء إضافة مركز التكلفة — حاول تاني (لو الكود مكرّر، جرّب كود مختلف)." };
  }

  revalidatePath("/accounting/cost-centers");
  return {};
}

const CostCenterEditSchema = z.object({
  name: z.string().trim().min(1, "الاسم مطلوب"),
  type: z.enum(COST_CENTER_TYPES, "اختار نوع مركز تكلفة صحيح"),
});

export type CostCenterEditFormState = { errors?: Record<string, string[]>; formError?: string; success?: boolean };

/** تعديل عام — الاسم والنوع بس. عمدًا مش `code`: معرّف فريد (`@@unique([orgId, code])`) بيُستخدم
 * كوسم تحليلي مرتبط بقيود/موازنات/أصول ثابتة قديمة — تغييره بعد الاستخدام يبوّظ أي مرجع نصي خارجي. */
export async function updateCostCenterAction(
  costCenterId: string,
  _prevState: CostCenterEditFormState,
  formData: FormData
): Promise<CostCenterEditFormState> {
  const parsed = CostCenterEditSchema.safeParse({ name: formData.get("name"), type: formData.get("type") });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const user = await requireCurrentUser();
  try {
    await requirePermission(user.roleId, "CostCenter", "Edit");
    await withScopedTransaction(async (tx) => {
      const before = await tx.costCenter.findUniqueOrThrow({ where: { id: costCenterId }, select: { name: true, type: true } });
      await tx.costCenter.update({ where: { id: costCenterId }, data: parsed.data });
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "costCenter.updated",
        entityType: "CostCenter",
        entityId: costCenterId,
        beforeValue: before,
        afterValue: parsed.data,
      });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "updateCostCenterAction", error: e });
    return { formError: businessRuleMessage(e, "حصل خطأ أثناء تعديل مركز التكلفة — حاول تاني.") };
  }

  revalidatePath("/accounting/cost-centers");
  return { success: true };
}

const PROFIT_CENTER_SCOPES = ["Company", "Division", "Product", "Market"] as const;

const ProfitCenterSchema = z.object({
  code: z.string().trim().min(1, "الكود مطلوب"),
  name: z.string().trim().min(1, "الاسم مطلوب"),
  scope: z.enum(PROFIT_CENTER_SCOPES, "اختار نطاق مركز ربحية صحيح"),
});

export type ProfitCenterFormState = { errors?: Record<string, string[]>; formError?: string };

export async function createProfitCenter(_prevState: ProfitCenterFormState, formData: FormData): Promise<ProfitCenterFormState> {
  const parsed = ProfitCenterSchema.safeParse({
    code: formData.get("code"),
    name: formData.get("name"),
    scope: formData.get("scope"),
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const user = await requireCurrentUser();
  try {
    await requirePermission(user.roleId, "ProfitCenter", "Create");
    await withScopedTransaction(async (tx) => {
      const pc = await tx.profitCenter.create({ data: { orgId: user.orgId, ...parsed.data } });
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "profitCenter.created",
        entityType: "ProfitCenter",
        entityId: pc.id,
        afterValue: { ...parsed.data },
      });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "createProfitCenter", error: e });
    return { formError: "حصل خطأ أثناء إضافة مركز الربحية — حاول تاني (لو الكود مكرّر، جرّب كود مختلف)." };
  }

  revalidatePath("/accounting/profit-centers");
  return {};
}

const ProfitCenterEditSchema = z.object({
  name: z.string().trim().min(1, "الاسم مطلوب"),
  scope: z.enum(PROFIT_CENTER_SCOPES, "اختار نطاق مركز ربحية صحيح"),
});

export type ProfitCenterEditFormState = { errors?: Record<string, string[]>; formError?: string; success?: boolean };

/** تعديل عام — الاسم والنطاق بس. عمدًا مش `code` (نفس منطق CostCenter). */
export async function updateProfitCenterAction(
  profitCenterId: string,
  _prevState: ProfitCenterEditFormState,
  formData: FormData
): Promise<ProfitCenterEditFormState> {
  const parsed = ProfitCenterEditSchema.safeParse({ name: formData.get("name"), scope: formData.get("scope") });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const user = await requireCurrentUser();
  try {
    await requirePermission(user.roleId, "ProfitCenter", "Edit");
    await withScopedTransaction(async (tx) => {
      const before = await tx.profitCenter.findUniqueOrThrow({ where: { id: profitCenterId }, select: { name: true, scope: true } });
      await tx.profitCenter.update({ where: { id: profitCenterId }, data: parsed.data });
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "profitCenter.updated",
        entityType: "ProfitCenter",
        entityId: profitCenterId,
        beforeValue: before,
        afterValue: parsed.data,
      });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "updateProfitCenterAction", error: e });
    return { formError: businessRuleMessage(e, "حصل خطأ أثناء تعديل مركز الربحية — حاول تاني.") };
  }

  revalidatePath("/accounting/profit-centers");
  return { success: true };
}

const JOURNAL_ENTRY_SOURCE_TYPES = ["Manual", "Automatic", "Recurring", "Reversal", "Accrual", "Adjustment"] as const;

const JournalLineInputSchema = z.object({
  accountId: z.string().uuid("اختر حساب"),
  debit: z.coerce.number().min(0, "لازم يكون 0 أو أكتر"),
  credit: z.coerce.number().min(0, "لازم يكون 0 أو أكتر"),
  currency: z.string().trim().length(3, "لازم 3 حروف (ISO 4217)").toUpperCase(),
  costCenterId: z.string().uuid().optional().or(z.literal("")),
  profitCenterId: z.string().uuid().optional().or(z.literal("")),
  description: z.string().trim().optional().or(z.literal("")),
});

export type JournalEntryFormState = { errors?: Record<string, string[]>; formError?: string; entryId?: string };

/** فورم ديناميكي متعدد البنود — كل عمود بيتقرا بـformData.getAll() بالترتيب اللي ظهر بيه في الصفحة
 * (نفس ترتيب الصفوف). القيد بيتسجّل Draft بس — المراجعة والترحيل الفعلي (Draft→Posted، اللي بيفعّل
 * Trigger enforce_journal_entry_balanced) خطوة منفصلة من صفحة تفاصيل القيد (postJournalEntryAction). */
export async function createJournalEntry(_prevState: JournalEntryFormState, formData: FormData): Promise<JournalEntryFormState> {
  const periodId = formData.get("periodId");
  const entryDate = formData.get("entryDate");
  const description = formData.get("description");
  const sourceType = formData.get("sourceType");

  if (typeof periodId !== "string" || !periodId) return { formError: "اختر فترة محاسبية." };
  if (typeof entryDate !== "string" || !entryDate) return { formError: "تاريخ القيد مطلوب." };

  const accountIds = formData.getAll("lineAccountId");
  const debits = formData.getAll("lineDebit");
  const credits = formData.getAll("lineCredit");
  const currencies = formData.getAll("lineCurrency");
  const costCenterIds = formData.getAll("lineCostCenterId");
  const profitCenterIds = formData.getAll("lineProfitCenterId");
  const lineDescriptions = formData.getAll("lineDescription");

  const rawLines = accountIds.map((_, i) => ({
    accountId: accountIds[i],
    debit: debits[i] || 0,
    credit: credits[i] || 0,
    currency: currencies[i],
    costCenterId: costCenterIds[i] || undefined,
    profitCenterId: profitCenterIds[i] || undefined,
    description: lineDescriptions[i] || undefined,
  }));

  const parsedLines = z.array(JournalLineInputSchema).min(2, "لازم بندين على الأقل (مدين ودائن)").safeParse(rawLines);
  if (!parsedLines.success) return { formError: "بيانات بنود القيد غير صالحة — راجع الحسابات والمبالغ والعملة." };

  const user = await requireCurrentUser();
  try {
    await requirePermission(user.roleId, "JournalEntry", "Create");

    // periodId/accountId/costCenterId/profitCenterId كلهم من فورم القيد اليدوي بلا تحقق —
    // `entry.period.periodName`/`l.account.accountCode` بيتعرضوا بلا `?.` في صفحة تفاصيل القيد
    // (أخطر صفحة في المشروع كله من ناحية البيانات المالية الخام) — أي id عابر للمنظمة كان
    // هيكسرها بالكامل (اتكشف في مراجعة وحدة 8، 6 سبتمبر). ⚠️ مش Promise.all — راجع P2028.
    const scopedPrisma = await getScopedPrisma();
    const period = await scopedPrisma.accountingPeriod.findFirst({ where: { id: periodId } });
    if (!period) return { formError: "الفترة المحاسبية غير موجودة." };
    const accountIdSet = [...new Set(parsedLines.data.map((l) => l.accountId))];
    const foundAccounts = await scopedPrisma.chartOfAccount.findMany({ where: { id: { in: accountIdSet } } });
    if (foundAccounts.length !== accountIdSet.length) return { formError: "فيه حساب غير موجود ضمن بنود القيد." };
    const centerIdSet = [
      ...new Set(parsedLines.data.flatMap((l) => [l.costCenterId, l.profitCenterId].filter((v): v is string => Boolean(v)))),
    ];
    if (centerIdSet.length > 0) {
      const foundCostCenters = await scopedPrisma.costCenter.findMany({ where: { id: { in: centerIdSet } } });
      const foundProfitCenters = await scopedPrisma.profitCenter.findMany({ where: { id: { in: centerIdSet } } });
      const foundIds = new Set([...foundCostCenters.map((c) => c.id), ...foundProfitCenters.map((c) => c.id)]);
      if (!centerIdSet.every((id) => foundIds.has(id))) {
        return { formError: "فيه مركز تكلفة أو ربحية غير موجود ضمن بنود القيد." };
      }
    }

    const entryId = await withScopedTransaction(async (tx) => {
      const id = await createJournalEntryDraft(tx, {
        orgId: user.orgId,
        entryDate: new Date(entryDate),
        periodId,
        sourceType: (sourceType as string) as (typeof JOURNAL_ENTRY_SOURCE_TYPES)[number],
        sourceModule: "Manual",
        description: typeof description === "string" && description ? description : undefined,
        preparedBy: user.id,
        lines: parsedLines.data,
      });
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "journalEntry.created",
        entityType: "JournalEntry",
        entityId: id,
        afterValue: { periodId, lineCount: parsedLines.data.length },
      });
      return id;
    });

    revalidatePath("/accounting/journal-entries");
    return { entryId };
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "createJournalEntry", error: e });
    return { formError: businessRuleMessage(e, "حصل خطأ أثناء حفظ القيد — حاول تاني.") };
  }
}

/** بيرحّل قيد Draft موجود — Draft→Posted، بيفعّل Trigger enforce_journal_entry_balanced على مستوى
 * القاعدة. لو القيد مش متوازن فعليًا، الترحيل بيترفض بـException حقيقي من القاعدة. */
export async function postJournalEntryAction(journalEntryId: string) {
  const user = await requireCurrentUser();
  await requirePermission(user.roleId, "JournalEntry", "Edit");

  try {
    await withScopedTransaction(async (tx) => {
      await postJournalEntryById(tx, journalEntryId);
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "journalEntry.posted",
        entityType: "JournalEntry",
        entityId: journalEntryId,
      });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "postJournalEntryAction", error: e });
    throw new Error("القيد غير متوازن أو حصل خطأ أثناء الترحيل — راجع البنود وحاول تاني.");
  }

  revalidatePath(`/accounting/journal-entries/${journalEntryId}`);
  revalidatePath("/accounting/journal-entries");
}

/** حذف مسودة قيد — Draft بس (حارس تطبيقي + Trigger enforce_journal_entry_no_delete_posted
 * على مستوى القاعدة). القيود المرحّلة لا تُحذف أبدًا — تُعكس. */
export async function deleteDraftJournalEntryAction(journalEntryId: string) {
  const user = await requireCurrentUser();
  await requirePermission(user.roleId, "JournalEntry", "Edit");

  try {
    await withScopedTransaction(async (tx) => {
      const entry = await tx.journalEntry.findUniqueOrThrow({ where: { id: journalEntryId }, select: { status: true, entryNumber: true } });
      if (entry.status !== "Draft") throw new Error(`القيد ${entry.entryNumber} مش مسودة — القيود المرحّلة تُعكس، مش تُحذف.`);
      await tx.journalLine.deleteMany({ where: { journalEntryId } });
      await tx.journalEntry.delete({ where: { id: journalEntryId } });
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "journalEntry.draftDeleted",
        entityType: "JournalEntry",
        entityId: journalEntryId,
        beforeValue: { entryNumber: entry.entryNumber },
      });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "deleteDraftJournalEntryAction", error: e });
    throw new Error("حصل خطأ أثناء حذف المسودة — حاول تاني.");
  }

  revalidatePath("/accounting/journal-entries");
  redirect("/accounting/journal-entries");
}

/** عكس قيد مرحّل — مسار التصحيح الشرعي الوحيد. بينشئ قيد Reversal معكوس البنود ويعلّم الأصل
 * Reversed، ويرجّع id القيد العكسي الجديد. */
export async function reverseJournalEntryAction(journalEntryId: string): Promise<string> {
  const user = await requireCurrentUser();
  await requirePermission(user.roleId, "JournalEntry", "Edit");

  let reversalId: string;
  try {
    reversalId = await withScopedTransaction(async (tx) => {
      const id = await reverseJournalEntry(tx, { journalEntryId, preparedBy: user.id });
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "journalEntry.reversed",
        entityType: "JournalEntry",
        entityId: journalEntryId,
        afterValue: { reversalEntryId: id },
      });
      return id;
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "reverseJournalEntryAction", error: e });
    throw new Error(businessRuleMessage(e, "حصل خطأ أثناء عكس القيد — حاول تاني."));
  }

  revalidatePath("/accounting/journal-entries");
  revalidatePath(`/accounting/journal-entries/${journalEntryId}`);
  return reversalId;
}
