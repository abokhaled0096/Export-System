import { Prisma } from "@/generated/prisma/client";
import type { ScopedTx } from "@/lib/scoped-prisma";
import type { JournalEntrySourceType } from "@/generated/prisma/enums";
import { computeDepreciation } from "@/lib/depreciation";
import { checkBudgetAlerts } from "./budget";

export type PostingLine = {
  accountId: string;
  debit?: Prisma.Decimal | number | string;
  credit?: Prisma.Decimal | number | string;
  currency: string;
  fxRateId?: string;
  costCenterId?: string;
  profitCenterId?: string;
  dealId?: string;
  shipmentId?: string;
  supplierId?: string;
  description?: string;
};

export type CreateJournalEntryInput = {
  orgId: string;
  entryDate: Date;
  periodId: string;
  sourceType: JournalEntrySourceType;
  sourceModule?: string;
  description?: string;
  preparedBy: string;
  reversalOfId?: string;
  lines: PostingLine[];
};

/** لو البنود بعملات مختلفة، التوازن الحقيقي (بالقيمة الوظيفية) بيتفحص وقت الترحيل على مستوى
 * القاعدة (enforce_journal_entry_balanced) — بيحتاج يجيب Organization.functionalCurrency
 * وأسعار الصرف، فمش هنكرره هنا بلا داعي. التحقق هنا (رفض مبكر، تحسين UX بس) مقصور على القيود
 * أحادية العملة، اللي لسه الغالبية الساحقة. */
function assertBalanced(lines: PostingLine[]) {
  const currencies = new Set(lines.map((l) => l.currency));
  if (currencies.size > 1) return;

  const totalDebit = lines.reduce((sum, l) => sum.add(new Prisma.Decimal(l.debit ?? 0)), new Prisma.Decimal(0));
  const totalCredit = lines.reduce((sum, l) => sum.add(new Prisma.Decimal(l.credit ?? 0)), new Prisma.Decimal(0));

  if (!totalDebit.equals(totalCredit)) {
    throw new Error(`القيد غير متوازن — إجمالي المدين (${totalDebit.toString()}) لازم يساوي إجمالي الدائن (${totalCredit.toString()})`);
  }
  if (totalDebit.equals(0)) {
    throw new Error("مينفعش إنشاء قيد بلا بنود فعلية.");
  }
}

/** ترقيم آمن ضد التزامن: advisory lock على مستوى الـtransaction (مفتاحه org+سنة) بيسلسل حساب
 * الرقم التالي — قيدين متزامنين مستحيل ياخدوا نفس JE-{year}-{seq}. (حلقة retry جوه نفس الـ
 * transaction مش حل في Postgres — أول فشل unique بيلغي الـtransaction كلها.) */
async function nextEntryNumber(tx: ScopedTx, orgId: string, year: number): Promise<string> {
  // $executeRaw مش $queryRaw — pg_advisory_xact_lock بترجّع void وPrisma مبتعرفش تفك تشفيرها كنتيجة.
  const lockKey = `JE-${orgId}-${year}`;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`;
  const countThisYear = await tx.journalEntry.count({ where: { orgId, entryNumber: { startsWith: `JE-${year}-` } } });
  return `JE-${year}-${String(countThisYear + 1).padStart(5, "0")}`;
}

/**
 * نقطة الدخول الموحّدة لإنشاء قيد محاسبي (Draft) في المنظومة كلها — أي وحدة تانية (AR/AP لاحقًا،
 * تسوية عملة، إلخ) المفروض تستخدم الدالة دي بدل ما تكتب JournalEntry/JournalLine يدويًا بطريقتها
 * الخاصة. بيستخدم Prisma.Decimal بالكامل لكل حساب مالي (docs/ERD.md §1 — إنفاذ إلزامي، ممنوع
 * Number/float). التحقق من التوازن/العملة الموحّدة هنا تحسين UX (رفض مبكر) — الإنفاذ الحقيقي غير
 * القابل للالتفاف حواليه هو Triggers القاعدة (توازن + عملة موحّدة + immutability للمرحّل + قفل
 * الفترات + نطاق التاريخ)، مش التحقق في التطبيق.
 */
export async function createJournalEntryDraft(tx: ScopedTx, input: CreateJournalEntryInput): Promise<string> {
  assertBalanced(input.lines);

  const year = input.entryDate.getFullYear();
  const entryNumber = await nextEntryNumber(tx, input.orgId, year);

  const entry = await tx.journalEntry.create({
    data: {
      orgId: input.orgId,
      entryNumber,
      entryDate: input.entryDate,
      periodId: input.periodId,
      sourceType: input.sourceType,
      sourceModule: input.sourceModule,
      description: input.description,
      preparedBy: input.preparedBy,
      reversalOfId: input.reversalOfId,
      status: "Draft",
    },
  });

  await tx.journalLine.createMany({
    data: input.lines.map((l) => ({
      orgId: input.orgId,
      journalEntryId: entry.id,
      accountId: l.accountId,
      debit: new Prisma.Decimal(l.debit ?? 0),
      credit: new Prisma.Decimal(l.credit ?? 0),
      currency: l.currency,
      fxRateId: l.fxRateId,
      costCenterId: l.costCenterId,
      profitCenterId: l.profitCenterId,
      dealId: l.dealId,
      shipmentId: l.shipmentId,
      supplierId: l.supplierId,
      description: l.description,
    })),
  });

  return entry.id;
}

/** بيرحّل قيد موجود (Draft → Posted) — دي اللي بتفعّل Trigger enforce_journal_entry_balanced على
 * مستوى القاعدة فعليًا (توازن + عملة موحّدة + الفترة مش HardClosed). بعد الترحيل، القيد وبنوده
 * immutable بالكامل على مستوى القاعدة — التصحيح الشرعي الوحيد reverseJournalEntry(). نقطة الوصل
 * الوحيدة لكل مسارات الترحيل (يدوي أو آلي) — أنسب مكان لفحص تجاوز الموازنة (checkBudgetAlerts)
 * بعد كل قيد يتحوّل لـPosted، بلا حاجة نداء يدوي في كل مسار على حدة. */
export async function postJournalEntryById(tx: ScopedTx, journalEntryId: string): Promise<void> {
  const entry = await tx.journalEntry.update({ where: { id: journalEntryId }, data: { status: "Posted" } });
  await checkBudgetAlerts(tx, { orgId: entry.orgId, periodId: entry.periodId, journalEntryId });
}

/** اختصار للترحيل التلقائي الفوري (إنشاء + ترحيل في نفس الخطوة) — للاستخدام من وحدات تانية بترحّل
 * قيود آلية بلا مراجعة بشرية (AR/AP، تسوية عملة، إلخ)، عكس الإدخال اليدوي اللي بيفضل Draft للمراجعة. */
export async function postJournalEntry(tx: ScopedTx, input: CreateJournalEntryInput): Promise<string> {
  const id = await createJournalEntryDraft(tx, input);
  await postJournalEntryById(tx, id);
  return id;
}

/** مسار التصحيح الشرعي الوحيد لقيد مرحّل: قيد عكسي جديد (مدين↔دائن) بـsourceType=Reversal
 * وreversalOfId مضبوط، بيترحّل فورًا، والأصل بيتعلّم Reversed (انتقال الحالة الوحيد المسموح
 * لقيد Posted على مستوى القاعدة). القيد العكسي بياخد نفس فترة وتاريخ الأصل — لو الفترة اتقفلت
 * نهائيًا، الترحيل بيترفض من الـTrigger برسالة واضحة (افتح قيد تسوية في فترة مفتوحة بدلًا). */
export async function reverseJournalEntry(tx: ScopedTx, { journalEntryId, preparedBy }: { journalEntryId: string; preparedBy: string }): Promise<string> {
  const original = await tx.journalEntry.findUniqueOrThrow({
    where: { id: journalEntryId },
    include: { lines: true },
  });

  if (original.status !== "Posted") {
    throw new Error(`القيد ${original.entryNumber} حالته ${original.status} — القيود المرحّلة (Posted) بس القابلة للعكس.`);
  }

  const reversalId = await postJournalEntry(tx, {
    orgId: original.orgId,
    entryDate: original.entryDate,
    periodId: original.periodId,
    sourceType: "Reversal",
    sourceModule: original.sourceModule ?? undefined,
    description: `عكس القيد ${original.entryNumber}${original.description ? ` — ${original.description}` : ""}`,
    preparedBy,
    reversalOfId: original.id,
    lines: original.lines.map((l) => ({
      accountId: l.accountId,
      debit: l.credit,
      credit: l.debit,
      currency: l.currency,
      fxRateId: l.fxRateId ?? undefined,
      costCenterId: l.costCenterId ?? undefined,
      profitCenterId: l.profitCenterId ?? undefined,
      dealId: l.dealId ?? undefined,
      shipmentId: l.shipmentId ?? undefined,
      supplierId: l.supplierId ?? undefined,
      description: l.description ?? undefined,
    })),
  });

  await tx.journalEntry.update({ where: { id: original.id }, data: { status: "Reversed" } });

  return reversalId;
}

// ==================== محرك ترحيل AR/AP (وحدة 8، الشريحة التانية) ====================
// أول استهلاك فعلي لـpostJournalEntry() من خارج الإدخال اليدوي.

export { GL_ACCOUNTS } from "./glAccounts";
import { GL_ACCOUNTS } from "./glAccounts";

type GlAccountKey = keyof typeof GL_ACCOUNTS;

/** بيحوّل أكواد الحسابات لـids فعلية، وبيرمي خطأ واضح لو حساب ناقص من شجرة الحسابات
 * (بدل ما القيد يترحّل ناقص أو يفشل برسالة FK غامضة). */
export async function resolveAccountIds(tx: ScopedTx, orgId: string, keys: GlAccountKey[]): Promise<Record<string, string>> {
  const codes = keys.map((k) => GL_ACCOUNTS[k]);
  const accounts = await tx.chartOfAccount.findMany({
    where: { orgId, accountCode: { in: codes } },
    select: { id: true, accountCode: true },
  });
  const byCode = new Map(accounts.map((a) => [a.accountCode, a.id]));

  const result: Record<string, string> = {};
  for (const key of keys) {
    const code = GL_ACCOUNTS[key];
    const id = byCode.get(code);
    if (!id) throw new Error(`حساب "${code}" مش موجود في شجرة الحسابات — لازم يتضاف قبل الترحيل.`);
    result[key] = id;
  }
  return result;
}

/**
 * بيحلّ حساب "النقدية" (1010) حسب عملة المعاملة الفعلية — مش المفتاح الثابت CASH دايمًا.
 * لو المنظمة مفعّلتش `functionalCurrency` أصلًا، أو المعاملة بعملة المنظمة الوظيفية نفسها،
 * الحساب الأساسي 1010 بيرجع زي ما هو (بلا أي تغيير سلوك للمنظمات اللي مش مفعّلة الميزة).
 *
 * لو المعاملة بعملة أجنبية فعلية، بيرجّع (أو ينشئ لو أول مرة) حساب فرعي مخصَّص لهذه العملة
 * بس (`1010-USD` مثلًا) — نفس الممارسة القياسية في أنظمة محاسبة حقيقية (QuickBooks/Xero/
 * NetSuite/Odoo كلها بتعامل كل عملة بحساب GL منفصل، مش ببُعد تحليلي على القيد، عشان تقدر
 * تعيد تقييم رصيد كل عملة لوحده — راجع BACKLOG.md § "محرك فروق العملة مقيَّد بـAR/AP بس").
 * إنشاء ديناميكي بـupsert بدل قائمة عملات مُخمَّنة مسبقًا — أي عملة جديدة بتاخد حسابها الفرعي
 * أول مرة تُستخدم فيها، بلا حاجة لتخمين إيه العملات اللي المنظمة هتستخدمها مقدَّمًا.
 */
export async function resolveCashAccountId(tx: ScopedTx, orgId: string, currency: string): Promise<string> {
  const org = await tx.organization.findUniqueOrThrow({ where: { id: orgId }, select: { functionalCurrency: true } });
  const baseCashId = (await resolveAccountIds(tx, orgId, ["CASH"])).CASH;
  if (!org.functionalCurrency || currency === org.functionalCurrency) return baseCashId;

  const accountCode = `${GL_ACCOUNTS.CASH}-${currency}`;
  const account = await tx.chartOfAccount.upsert({
    where: { orgId_accountCode: { orgId, accountCode } },
    create: {
      orgId,
      accountCode,
      nameAr: `نقدية بعملة ${currency}`,
      nameEn: `Cash — ${currency}`,
      accountType: "Asset",
      normalBalance: "Debit",
      currency,
      parentAccountId: baseCashId,
    },
    update: {},
  });
  return account.id;
}

/**
 * بيحلّ fxRateId مطلوب لأي بند بعملة مختلفة عن عملة المنظمة الوظيفية — نفس النمط المستخدم في
 * issueInvoiceAction/clearPaymentAction (arap-actions.ts) بالحرف، مُستخرج هنا كدالة مشتركة
 * عشان يُعاد استخدامه في كل مسارات الترحيل اللي ممكن تلمس حساب نقدية بعملة أجنبية (قرض، أصل
 * ثابت، ضريبة، عمولة) — كلهم عندهم نفس الاحتياج بالظبط: لو العملة أجنبية، لازم سعر صرف صريح
 * وقت الترحيل، وإلا الـTrigger هيرفض القيد برسالة تقنية مش واضحة للمستخدم.
 */
export async function resolveFxRateId(
  tx: ScopedTx,
  orgId: string,
  currency: string,
  rateDate: Date,
  fxRate: string | undefined
): Promise<string | undefined> {
  const org = await tx.organization.findUniqueOrThrow({ where: { id: orgId }, select: { functionalCurrency: true } });
  const needsFxRate = !!org.functionalCurrency && currency !== org.functionalCurrency;
  if (!needsFxRate) return undefined;
  if (!fxRate) {
    throw new Error(`العملية بعملة ${currency} مختلفة عن عملة المنظمة الوظيفية (${org.functionalCurrency}) — لازم سعر صرف.`);
  }
  const exchangeRate = await tx.exchangeRate.create({
    data: { orgId, baseCurrency: currency, quoteCurrency: org.functionalCurrency!, rate: fxRate, rateDate, rateType: "Spot" },
  });
  return exchangeRate.id;
}

/** بيدوّر على فترة محاسبية مفتوحة بتغطي التاريخ ده — الترحيل التلقائي محتاج فترة صالحة،
 * والـTrigger enforce_entry_date_within_period بيرفض أي تاريخ برّه نطاق فترته. */
export async function findOpenPeriodFor(tx: ScopedTx, orgId: string, date: Date): Promise<string> {
  const period = await tx.accountingPeriod.findFirst({
    where: { orgId, status: "Open", startDate: { lte: date }, endDate: { gte: date } },
    select: { id: true, periodName: true },
  });
  if (!period) {
    throw new Error(`مفيش فترة محاسبية مفتوحة بتغطي تاريخ ${date.toISOString().slice(0, 10)} — افتح فترة الأول من صفحة الفترات المحاسبية.`);
  }
  return period.id;
}

export type InvoiceForPosting = {
  id: string;
  orgId: string;
  invoiceNumber: string;
  invoiceType: string;
  currency: string;
  subtotal: Prisma.Decimal;
  taxAmount: Prisma.Decimal;
  totalAmount: Prisma.Decimal;
  issueDate: Date;
  dealId: string | null;
  supplierId: string | null;
  /// لازم لو Organization.functionalCurrency مفعّلة وcurrency الفاتورة مختلفة عنها — بيتسجّل
  /// على بند AR/AP نفسه، وده اللي بيحفظ "سعر الإصدار" لحساب فرق العملة المحقَّق لاحقًا وقت
  /// التخصيص الفعلي (postPaymentAllocated) — راجع migration 20260916120000.
  fxRateId?: string;
};

/**
 * بيرحّل قيد إصدار الفاتورة:
 * - فاتورة مبيعات: مدين ذمم مدينة (بالإجمالي) / دائن إيراد (بالصافي) + دائن ض.ق.م مبيعات (بالضريبة)
 * - فاتورة مشتريات: مدين تكلفة (بالصافي) + مدين ض.ق.م مشتريات / دائن ذمم دائنة (بالإجمالي)
 * وسم الأبعاد (dealId/supplierId) بيتمرّر للبنود — ده اللي بيخلّي ربح الصفقة يتحسب من الدفتر
 * فعليًا مش من تقدير التسعير (docs/ERD.md §11 مقدمة).
 */
export async function postInvoiceIssued(tx: ScopedTx, invoice: InvoiceForPosting, preparedBy: string): Promise<string> {
  const periodId = await findOpenPeriodFor(tx, invoice.orgId, invoice.issueDate);
  const isSales = invoice.invoiceType === "SalesInvoice";
  const hasTax = new Prisma.Decimal(invoice.taxAmount).greaterThan(0);

  const acc = await resolveAccountIds(
    tx,
    invoice.orgId,
    isSales ? (hasTax ? ["AR", "REVENUE", "VAT_OUTPUT"] : ["AR", "REVENUE"]) : hasTax ? ["COGS", "VAT_INPUT", "AP"] : ["COGS", "AP"]
  );

  // fxRateId بيتحط على كل بنود القيد (مش بس AR/AP) — كلهم بعملة الفاتورة نفسها، فكلهم محتاجين
  // نفس الترجمة للقيمة الوظيفية لو العملة مختلفة عن عملة المنظمة (compute_journal_line_functional_amounts).
  const dims = { dealId: invoice.dealId ?? undefined, supplierId: invoice.supplierId ?? undefined, fxRateId: invoice.fxRateId };
  const lines: PostingLine[] = isSales
    ? [
        { accountId: acc.AR, debit: invoice.totalAmount, currency: invoice.currency, description: `فاتورة مبيعات ${invoice.invoiceNumber}`, ...dims },
        { accountId: acc.REVENUE, credit: invoice.subtotal, currency: invoice.currency, description: `إيراد ${invoice.invoiceNumber}`, ...dims },
        ...(hasTax ? [{ accountId: acc.VAT_OUTPUT, credit: invoice.taxAmount, currency: invoice.currency, description: `ض.ق.م ${invoice.invoiceNumber}`, ...dims }] : []),
      ]
    : [
        { accountId: acc.COGS, debit: invoice.subtotal, currency: invoice.currency, description: `فاتورة مشتريات ${invoice.invoiceNumber}`, ...dims },
        ...(hasTax ? [{ accountId: acc.VAT_INPUT, debit: invoice.taxAmount, currency: invoice.currency, description: `ض.ق.م ${invoice.invoiceNumber}`, ...dims }] : []),
        { accountId: acc.AP, credit: invoice.totalAmount, currency: invoice.currency, description: `ذمم دائنة ${invoice.invoiceNumber}`, ...dims },
      ];

  return postJournalEntry(tx, {
    orgId: invoice.orgId,
    entryDate: invoice.issueDate,
    periodId,
    sourceType: "Automatic",
    sourceModule: isSales ? "AR" : "AP",
    description: `إصدار ${isSales ? "فاتورة مبيعات" : "فاتورة مشتريات"} ${invoice.invoiceNumber}`,
    preparedBy,
    lines,
  });
}

export type PaymentForPosting = {
  id: string;
  orgId: string;
  paymentNumber: string;
  direction: string;
  amount: Prisma.Decimal;
  currency: string;
  paymentDate: Date;
  supplierId: string | null;
  /// راجع InvoiceForPosting.fxRateId — نفس المبدأ، لكن هنا "سعر التحصيل/السداد" مش "سعر
  /// الإصدار". الفرق بين الاتنين (لنفس الفاتورة، وقت التخصيص) هو فرق العملة المحقَّق.
  fxRateId?: string;
};

/**
 * بيرحّل قيد التحصيل/السداد:
 * - Organization.functionalCurrency فاضية (السلوك القديم بالحرف): وارد → مدين نقدية/دائن ذمم
 *   مدينة مباشرة؛ صادر → مدين ذمم دائنة/دائن نقدية مباشرة.
 * - functionalCurrency مفعّلة: الطرف التاني بقى حساب "دفعات معلَّقة" (PAYMENT_CLEARING) بدل
 *   AR/AP مباشرة — الفاتورة (فواتيرها) ما زالت متعرفش وقت التحصيل، بيتحدَّدوا لاحقًا وبنسب
 *   مختلفة عبر PaymentAllocation. الإفراج الفعلي عن AR/AP (وحساب فرق العملة المحقَّق) بيحصل
 *   في postPaymentAllocated وقت التخصيص الفعلي — راجع migration 20260916120000.
 */
export async function postPaymentCleared(tx: ScopedTx, payment: PaymentForPosting, preparedBy: string): Promise<string> {
  const org = await tx.organization.findUniqueOrThrow({ where: { id: payment.orgId }, select: { functionalCurrency: true } });
  const periodId = await findOpenPeriodFor(tx, payment.orgId, payment.paymentDate);
  const isInbound = payment.direction === "Inbound";
  const dims = { supplierId: payment.supplierId ?? undefined, fxRateId: payment.fxRateId };

  let lines: PostingLine[];
  let sourceModule: string;
  if (org.functionalCurrency) {
    const acc = await resolveAccountIds(tx, payment.orgId, ["PAYMENT_CLEARING"]);
    acc.CASH = await resolveCashAccountId(tx, payment.orgId, payment.currency);
    lines = isInbound
      ? [
          { accountId: acc.CASH, debit: payment.amount, currency: payment.currency, description: `تحصيل ${payment.paymentNumber}`, ...dims },
          { accountId: acc.PAYMENT_CLEARING, credit: payment.amount, currency: payment.currency, description: `تحصيل معلَّق ${payment.paymentNumber} — لحد ما يتخصّص على فاتورة`, ...dims },
        ]
      : [
          { accountId: acc.PAYMENT_CLEARING, debit: payment.amount, currency: payment.currency, description: `سداد معلَّق ${payment.paymentNumber} — لحد ما يتخصّص على فاتورة`, ...dims },
          { accountId: acc.CASH, credit: payment.amount, currency: payment.currency, description: `سداد ${payment.paymentNumber}`, ...dims },
        ];
    sourceModule = "PaymentClearing";
  } else {
    const acc = await resolveAccountIds(tx, payment.orgId, isInbound ? ["AR"] : ["AP"]);
    acc.CASH = await resolveCashAccountId(tx, payment.orgId, payment.currency);
    lines = isInbound
      ? [
          { accountId: acc.CASH, debit: payment.amount, currency: payment.currency, description: `تحصيل ${payment.paymentNumber}`, ...dims },
          { accountId: acc.AR, credit: payment.amount, currency: payment.currency, description: `تحصيل ${payment.paymentNumber}`, ...dims },
        ]
      : [
          { accountId: acc.AP, debit: payment.amount, currency: payment.currency, description: `سداد ${payment.paymentNumber}`, ...dims },
          { accountId: acc.CASH, credit: payment.amount, currency: payment.currency, description: `سداد ${payment.paymentNumber}`, ...dims },
        ];
    sourceModule = isInbound ? "AR" : "AP";
  }

  return postJournalEntry(tx, {
    orgId: payment.orgId,
    entryDate: payment.paymentDate,
    periodId,
    sourceType: "Automatic",
    sourceModule,
    description: `${isInbound ? "تحصيل" : "سداد"} ${payment.paymentNumber}`,
    preparedBy,
    lines,
  });
}

export type AllocationForPosting = {
  orgId: string;
  paymentId: string;
  invoiceId: string;
  allocatedAmount: Prisma.Decimal;
  allocationDate: Date;
};

/**
 * بيرحّل قيد الإفراج عن AR/AP وقت التخصيص الفعلي لدفعة على فاتورة، وبيحسب فرق العملة المحقَّق
 * (الفرق بين "سعر إصدار الفاتورة" و"سعر تحصيل/سداد الدفعة" لنفس المبلغ المخصَّص بالظبط) —
 * راجع migration 20260916120000 والتعليق الطويل فوق postPaymentCleared لسبب التصميم.
 *
 * بيرجّع null (بلا أي قيد) في 3 حالات كلها آمنة تمامًا تُترَك للتوافق الخلفي: (1) المنظمة
 * مفعّلتش functionalCurrency أصلًا — الفاتورة اتصفّت بالفعل مباشرة وقت postPaymentCleared،
 * مفيش حاجة تانية تتعمل هنا. (2) الدفعة/الفاتورة لسه مترحّلتش (نادر، سباق توقيت). (3) عملة
 * الفاتورة/الدفعة أصلًا هي عملة المنظمة الوظيفية — مفيش فرق عملة ممكن يحصل، فمفيش داعي لقيد إضافي.
 */
export async function postPaymentAllocated(tx: ScopedTx, alloc: AllocationForPosting, preparedBy: string): Promise<string | null> {
  const org = await tx.organization.findUniqueOrThrow({ where: { id: alloc.orgId }, select: { functionalCurrency: true } });
  if (!org.functionalCurrency) return null;

  const [payment, invoice] = await Promise.all([
    tx.payment.findUniqueOrThrow({ where: { id: alloc.paymentId } }),
    tx.invoice.findUniqueOrThrow({ where: { id: alloc.invoiceId } }),
  ]);
  if (!payment.journalEntryId || !invoice.journalEntryId) return null;
  if (invoice.currency === org.functionalCurrency) return null;

  const isInbound = payment.direction === "Inbound";
  const acc = await resolveAccountIds(tx, alloc.orgId, isInbound ? ["PAYMENT_CLEARING", "AR", "FX_GAIN_LOSS"] : ["PAYMENT_CLEARING", "AP", "FX_GAIN_LOSS"]);

  const clearingLine = await tx.journalLine.findFirstOrThrow({ where: { journalEntryId: payment.journalEntryId, accountId: acc.PAYMENT_CLEARING } });
  const arApAccountId = isInbound ? acc.AR : acc.AP;
  const invoiceLine = await tx.journalLine.findFirstOrThrow({ where: { journalEntryId: invoice.journalEntryId, accountId: arApAccountId } });

  // نسبة الترجمة الفعلية لكل بند (وظيفي ÷ خام) — بديل عن إعادة جلب ExchangeRate.rate نفسها،
  // بيدّي نفس النتيجة بالظبط لأن compute_journal_line_functional_amounts خطي (functional = خام × rate).
  const clearingRatio = isInbound
    ? clearingLine.functionalCredit.div(clearingLine.credit)
    : clearingLine.functionalDebit.div(clearingLine.debit);
  const invoiceRatio = isInbound ? invoiceLine.functionalDebit.div(invoiceLine.debit) : invoiceLine.functionalCredit.div(invoiceLine.credit);

  const clearingFunctional = alloc.allocatedAmount.mul(clearingRatio);
  const arApFunctional = alloc.allocatedAmount.mul(invoiceRatio);
  const fxDiff = clearingFunctional.sub(arApFunctional); // موجب = ربح، سالب = خسارة

  const periodId = await findOpenPeriodFor(tx, alloc.orgId, alloc.allocationDate);
  const description = `تخصيص ${payment.paymentNumber} على فاتورة ${invoice.invoiceNumber}`;
  const dims = { dealId: invoice.dealId ?? undefined, supplierId: invoice.supplierId ?? undefined };

  // بند فرق العملة بعملة المنظمة الوظيفية مباشرة (بلا fxRateId) — مش تدفّق نقدي بعملة أجنبية،
  // مجرد إعادة قياس محاسبية، نفس منطق بند إعادة التقييم في src/lib/fxRevaluation.ts.
  const fxLine: PostingLine | null = fxDiff.gt(0)
    ? { accountId: acc.FX_GAIN_LOSS, credit: fxDiff, currency: org.functionalCurrency, description: `${description} — ربح فروق عملة`, ...dims }
    : fxDiff.lt(0)
      ? { accountId: acc.FX_GAIN_LOSS, debit: fxDiff.neg(), currency: org.functionalCurrency, description: `${description} — خسارة فروق عملة`, ...dims }
      : null;

  const lines: PostingLine[] = isInbound
    ? [
        { accountId: acc.PAYMENT_CLEARING, debit: alloc.allocatedAmount, currency: payment.currency, fxRateId: clearingLine.fxRateId ?? undefined, description, ...dims },
        { accountId: acc.AR, credit: alloc.allocatedAmount, currency: invoice.currency, fxRateId: invoiceLine.fxRateId ?? undefined, description, ...dims },
        ...(fxLine ? [fxLine] : []),
      ]
    : [
        { accountId: acc.AP, debit: alloc.allocatedAmount, currency: invoice.currency, fxRateId: invoiceLine.fxRateId ?? undefined, description, ...dims },
        { accountId: acc.PAYMENT_CLEARING, credit: alloc.allocatedAmount, currency: payment.currency, fxRateId: clearingLine.fxRateId ?? undefined, description, ...dims },
        ...(fxLine ? [fxLine] : []),
      ];

  return postJournalEntry(tx, {
    orgId: alloc.orgId,
    entryDate: alloc.allocationDate,
    periodId,
    sourceType: "Automatic",
    sourceModule: isInbound ? "AR" : "AP",
    description,
    preparedBy,
    lines,
  });
}

// ==================== محرك ترحيل الخزينة (وحدة 8، الشريحة التالتة) ====================

export type BankTransactionForPosting = {
  id: string;
  orgId: string;
  transactionType: string;
  amount: Prisma.Decimal;
  currency: string;
  transactionDate: Date;
  reference: string | null;
  /// راجع PaymentForPosting.fxRateId — مطلوب بس لو الحركة بعملة مختلفة عن عملة المنظمة
  /// الوظيفية (مصروف/فائدة على حساب بنكي أجنبي).
  fxRateId?: string;
};

/** أنواع الحركات البنكية اللي ليها ترحيل محاسبي مستقل.
 *
 * ⚠️ الإيداع/السحب/التحويل **مالهمش ترحيل هنا** عمدًا — دول بيقابلوا `Payment` مرحّلة بالفعل
 * (`postPaymentCleared`)، وترحيلهم تاني معناه ازدواج في الدفتر. الحركة اللي من غير دفعة
 * مضاهاة هي بند غير مفسَّر بيظهر كفرق في المطابقة البنكية — وده المطلوب بالظبط، مش إن
 * النظام يخترع لها حساب. */
export const POSTABLE_BANK_TRANSACTION_TYPES = ["Charge", "Interest"] as const;

export function isPostableBankTransaction(transactionType: string): boolean {
  return (POSTABLE_BANK_TRANSACTION_TYPES as readonly string[]).includes(transactionType);
}

/**
 * بيرحّل قيد الحركة البنكية:
 * - مصروف بنكي: مدين مصروفات بنكية / دائن نقدية
 * - فائدة دائنة: مدين نقدية / دائن إيرادات فوائد
 */
export async function postBankTransaction(
  tx: ScopedTx,
  transaction: BankTransactionForPosting,
  preparedBy: string
): Promise<string> {
  if (!isPostableBankTransaction(transaction.transactionType)) {
    throw new Error(
      "الإيداعات والسحوبات والتحويلات بتترحّل عبر الدفعة المضاهاة، مش كحركة مستقلة — الترحيل المستقل للمصروفات والفوائد بس."
    );
  }

  const periodId = await findOpenPeriodFor(tx, transaction.orgId, transaction.transactionDate);
  const isCharge = transaction.transactionType === "Charge";
  const acc = await resolveAccountIds(tx, transaction.orgId, isCharge ? ["BANK_CHARGES"] : ["INTEREST_INCOME"]);
  acc.CASH = await resolveCashAccountId(tx, transaction.orgId, transaction.currency);

  const label = isCharge ? "مصروف بنكي" : "فائدة بنكية";
  const description = transaction.reference ? `${label} ${transaction.reference}` : label;
  const dims = { fxRateId: transaction.fxRateId };

  const lines: PostingLine[] = isCharge
    ? [
        { accountId: acc.BANK_CHARGES, debit: transaction.amount, currency: transaction.currency, description, ...dims },
        { accountId: acc.CASH, credit: transaction.amount, currency: transaction.currency, description, ...dims },
      ]
    : [
        { accountId: acc.CASH, debit: transaction.amount, currency: transaction.currency, description, ...dims },
        { accountId: acc.INTEREST_INCOME, credit: transaction.amount, currency: transaction.currency, description, ...dims },
      ];

  return postJournalEntry(tx, {
    orgId: transaction.orgId,
    entryDate: transaction.transactionDate,
    periodId,
    sourceType: "Automatic",
    sourceModule: "Treasury",
    description,
    preparedBy,
    lines,
  });
}

export type LoanForPosting = {
  id: string;
  orgId: string;
  lenderName: string;
  principal: Prisma.Decimal;
  currency: string;
  startDate: Date;
  fxRateId?: string;
};

/** صرف القرض: مدين نقدية / دائن قروض دائنة. */
export async function postLoanDisbursement(tx: ScopedTx, loan: LoanForPosting, preparedBy: string): Promise<string> {
  const periodId = await findOpenPeriodFor(tx, loan.orgId, loan.startDate);
  const acc = await resolveAccountIds(tx, loan.orgId, ["LOANS_PAYABLE"]);
  acc.CASH = await resolveCashAccountId(tx, loan.orgId, loan.currency);
  const description = `صرف قرض — ${loan.lenderName}`;

  return postJournalEntry(tx, {
    orgId: loan.orgId,
    entryDate: loan.startDate,
    periodId,
    sourceType: "Automatic",
    sourceModule: "Treasury",
    description,
    preparedBy,
    lines: [
      { accountId: acc.CASH, debit: loan.principal, currency: loan.currency, description, fxRateId: loan.fxRateId },
      { accountId: acc.LOANS_PAYABLE, credit: loan.principal, currency: loan.currency, description, fxRateId: loan.fxRateId },
    ],
  });
}

export type LoanInstallmentForPosting = {
  id: string;
  orgId: string;
  principalPortion: Prisma.Decimal;
  interestPortion: Prisma.Decimal;
  dueDate: Date;
};

/**
 * سداد قسط القرض: مدين قروض دائنة (الأصل) + مدين أعباء تمويل (الفوائد) / دائن نقدية (الإجمالي).
 * فصل الأصل عن الفوائد هو الفرق بين قرض متتبَّع صح وقرض بيتعامل كمصروف — الأصل بيقلّل
 * الالتزام، والفوائد مصروف فعلي في قائمة الدخل.
 */
export async function postLoanInstallmentPaid(
  tx: ScopedTx,
  installment: LoanInstallmentForPosting,
  currency: string,
  lenderName: string,
  paymentDate: Date,
  preparedBy: string,
  fxRateId?: string
): Promise<string> {
  const periodId = await findOpenPeriodFor(tx, installment.orgId, paymentDate);
  const acc = await resolveAccountIds(tx, installment.orgId, ["LOANS_PAYABLE", "INTEREST_EXPENSE"]);
  acc.CASH = await resolveCashAccountId(tx, installment.orgId, currency);

  const total = installment.principalPortion.add(installment.interestPortion);
  const description = `سداد قسط قرض — ${lenderName}`;

  const lines: PostingLine[] = [
    { accountId: acc.LOANS_PAYABLE, debit: installment.principalPortion, currency, description: `${description} (أصل)`, fxRateId },
  ];
  // بند الفوائد بيتحط لو فيه فوائد بس — بند بصفر ممنوع في assertBalanced().
  if (installment.interestPortion.gt(0)) {
    lines.push({ accountId: acc.INTEREST_EXPENSE, debit: installment.interestPortion, currency, description: `${description} (فوائد)`, fxRateId });
  }
  lines.push({ accountId: acc.CASH, credit: total, currency, description, fxRateId });

  return postJournalEntry(tx, {
    orgId: installment.orgId,
    entryDate: paymentDate,
    periodId,
    sourceType: "Automatic",
    sourceModule: "Treasury",
    description,
    preparedBy,
    lines,
  });
}

// ==================== محرك ترحيل الموازنات/الأصول/الضرائب (وحدة 8، الشريحة الرابعة والأخيرة) ====================

export type NewFixedAssetForPosting = {
  id: string;
  orgId: string;
  assetCode: string;
  nameAr: string;
  purchaseValue: Prisma.Decimal;
  currency: string;
  costCenterId: string | null;
  fxRateId?: string;
};

/**
 * شراء أصل ثابت: مدين "الأصول الثابتة بالتكلفة" / دائن نقدية (افتراض شراء نقدي — نفس تبسيط
 * postLoanDisbursement). ⚠️ بند اتلقط وقت بناء التخلص من الأصل: الـERD مفيهوش أي قيد لشراء
 * الأصل نفسه، فالتخلص لاحقًا مالوش حساب يتشطب منه — الترحيل ده هو اللي بيسدّ الفجوة.
 */
export async function postFixedAssetAcquisition(
  tx: ScopedTx,
  asset: NewFixedAssetForPosting,
  purchaseDate: Date,
  preparedBy: string
): Promise<string> {
  const periodId = await findOpenPeriodFor(tx, asset.orgId, purchaseDate);
  const acc = await resolveAccountIds(tx, asset.orgId, ["FIXED_ASSETS_COST"]);
  acc.CASH = await resolveCashAccountId(tx, asset.orgId, asset.currency);
  const description = `شراء أصل ثابت ${asset.assetCode} — ${asset.nameAr}`;
  // ⚠️ إصلاح عيب حقيقي: النسخة الأولى مكانتش بتوسم البند بـcostCenterId رغم إن الأصل نفسه
  // متوسّم بيه — يعني تقرير موازنة مقابل فعلي (CAPEX) كان دايمًا هيطلّع صفر لأي بند مربوط
  // بمركز تكلفة، لأن حركة الشراء الفعلية كانت غير مرئية لأي تجميع بمركز التكلفة.
  const costCenterId = asset.costCenterId ?? undefined;

  return postJournalEntry(tx, {
    orgId: asset.orgId,
    entryDate: purchaseDate,
    periodId,
    sourceType: "Automatic",
    sourceModule: "FixedAssets",
    description,
    preparedBy,
    lines: [
      { accountId: acc.FIXED_ASSETS_COST, debit: asset.purchaseValue, currency: asset.currency, costCenterId, description, fxRateId: asset.fxRateId },
      { accountId: acc.CASH, credit: asset.purchaseValue, currency: asset.currency, costCenterId, description, fxRateId: asset.fxRateId },
    ],
  });
}

export type DepreciableAssetForPosting = {
  id: string;
  orgId: string;
  assetCode: string;
  nameAr: string;
  currency: string;
  purchaseValue: Prisma.Decimal;
  usefulLifeMonths: number;
  accumulatedDepreciation: Prisma.Decimal;
  depreciationMethod: string;
  costCenterId: string | null;
};

/**
 * تشغيل الإهلاك الدوري لكل الأصول النشطة في فترة معيّنة — قيد واحد مجمّع (مدين مصروف إهلاك /
 * دائن مجمّع إهلاك، بند لكل أصل بوسم costCenterId)، بدل ترحيل كل أصل لوحده. Idempotent: أي أصل
 * اتعمل له إهلاك الفترة دي بالفعل (بمقتضى @@unique(assetId, period)) بيتخطّى بصمت.
 * ده أقرب حاجة لـ"إقفال شهري" حقيقي في الوحدة كلها.
 */
export async function runDepreciationForPeriod(
  tx: ScopedTx,
  orgId: string,
  periodId: string,
  preparedBy: string
): Promise<{ journalEntryId: string | null; postedCount: number; skippedCount: number }> {
  const period = await tx.accountingPeriod.findUniqueOrThrow({ where: { id: periodId } });

  const assets: DepreciableAssetForPosting[] = await tx.fixedAsset.findMany({
    where: { orgId, status: "Active" },
    select: {
      id: true,
      orgId: true,
      assetCode: true,
      nameAr: true,
      currency: true,
      purchaseValue: true,
      usefulLifeMonths: true,
      accumulatedDepreciation: true,
      depreciationMethod: true,
      costCenterId: true,
    },
  });

  const alreadyPosted = await tx.depreciationEntry.findMany({
    where: { orgId, period: period.periodName, assetId: { in: assets.map((a) => a.id) } },
    select: { assetId: true },
  });
  const alreadyPostedIds = new Set(alreadyPosted.map((d) => d.assetId));

  // عدد الفترات اللي كل أصل اتترحّل له إهلاك بالفعل عبر كل الفترات (مش الفترة الحالية بس) —
  // مطلوب لمحرك الرصيد المتناقص عشان يعرف الباقي من العمر الإنتاجي (راجع depreciation.ts).
  const historicalCounts = await tx.depreciationEntry.groupBy({
    by: ["assetId"],
    where: { orgId, assetId: { in: assets.map((a) => a.id) } },
    _count: { id: true },
  });
  const periodsElapsedByAsset = new Map(historicalCounts.map((c) => [c.assetId, c._count.id]));

  const due = assets.filter((a) => !alreadyPostedIds.has(a.id));
  const lines: { asset: DepreciableAssetForPosting; amount: Prisma.Decimal }[] = [];
  for (const asset of due) {
    const amount = computeDepreciation({ ...asset, periodsElapsed: periodsElapsedByAsset.get(asset.id) ?? 0 });
    if (amount.gt(0)) lines.push({ asset, amount });
  }

  const skippedCount = assets.length - lines.length;
  if (lines.length === 0) return { journalEntryId: null, postedCount: 0, skippedCount: assets.length };

  const acc = await resolveAccountIds(tx, orgId, ["DEPRECIATION_EXPENSE", "ACCUMULATED_DEPRECIATION"]);

  const postingLines: PostingLine[] = [];
  for (const { asset, amount } of lines) {
    const description = `إهلاك ${asset.assetCode} — ${asset.nameAr} (${period.periodName})`;
    postingLines.push({
      accountId: acc.DEPRECIATION_EXPENSE,
      debit: amount,
      currency: asset.currency,
      costCenterId: asset.costCenterId ?? undefined,
      description,
    });
    postingLines.push({
      accountId: acc.ACCUMULATED_DEPRECIATION,
      credit: amount,
      currency: asset.currency,
      costCenterId: asset.costCenterId ?? undefined,
      description,
    });
  }

  const journalEntryId = await postJournalEntry(tx, {
    orgId,
    entryDate: period.endDate,
    periodId,
    sourceType: "Automatic",
    sourceModule: "FixedAssets",
    description: `إهلاك الفترة ${period.periodName} — ${lines.length} أصل`,
    preparedBy,
    lines: postingLines,
  });

  for (const { asset, amount } of lines) {
    await tx.depreciationEntry.create({
      data: { orgId, assetId: asset.id, period: period.periodName, amount, journalEntryId },
    });
  }

  return { journalEntryId, postedCount: lines.length, skippedCount };
}

export type FixedAssetForDisposal = {
  id: string;
  orgId: string;
  assetCode: string;
  nameAr: string;
  purchaseValue: Prisma.Decimal;
  accumulatedDepreciation: Prisma.Decimal;
  currency: string;
};

/**
 * التخلص من أصل: شطب تكلفته الأصلية (دائن 1060) ومجمّع إهلاكه (مدين 1050)، وإثبات الفرق بين
 * حصيلة البيع (مدين نقدية) والقيمة الدفترية الصافية كربح (دائن 7010) أو خسارة (مدين 7010).
 * docs/ERD.md §11.4 عنده disposalValue بس بلا أي قيد محاسبي يعكس القرار ده.
 */
export async function postAssetDisposal(
  tx: ScopedTx,
  asset: FixedAssetForDisposal,
  disposalValue: Prisma.Decimal,
  disposalDate: Date,
  preparedBy: string,
  fxRateId?: string
): Promise<string> {
  const periodId = await findOpenPeriodFor(tx, asset.orgId, disposalDate);
  const acc = await resolveAccountIds(tx, asset.orgId, ["ACCUMULATED_DEPRECIATION", "FIXED_ASSETS_COST", "ASSET_DISPOSAL_GAIN_LOSS"]);
  acc.CASH = await resolveCashAccountId(tx, asset.orgId, asset.currency);

  const netBookValue = asset.purchaseValue.sub(asset.accumulatedDepreciation);
  const gainOrLoss = disposalValue.sub(netBookValue); // موجب = ربح (دائن)، سالب = خسارة (مدين)
  const description = `التخلص من الأصل ${asset.assetCode} — ${asset.nameAr}`;

  const lines: PostingLine[] = [
    { accountId: acc.CASH, debit: disposalValue, currency: asset.currency, description, fxRateId },
    { accountId: acc.ACCUMULATED_DEPRECIATION, debit: asset.accumulatedDepreciation, currency: asset.currency, description, fxRateId },
    { accountId: acc.FIXED_ASSETS_COST, credit: asset.purchaseValue, currency: asset.currency, description, fxRateId },
  ];

  if (gainOrLoss.gt(0)) {
    lines.push({ accountId: acc.ASSET_DISPOSAL_GAIN_LOSS, credit: gainOrLoss, currency: asset.currency, description: `${description} — ربح`, fxRateId });
  } else if (gainOrLoss.lt(0)) {
    lines.push({ accountId: acc.ASSET_DISPOSAL_GAIN_LOSS, debit: gainOrLoss.neg(), currency: asset.currency, description: `${description} — خسارة`, fxRateId });
  }

  return postJournalEntry(tx, {
    orgId: asset.orgId,
    entryDate: disposalDate,
    periodId,
    sourceType: "Automatic",
    sourceModule: "FixedAssets",
    description,
    preparedBy,
    lines,
  });
}

export type TaxRecordForPayment = {
  id: string;
  orgId: string;
  taxType: string;
  amount: Prisma.Decimal;
  currency: string;
  fxRateId?: string;
};

/** سداد إقرار ضريبي: مدين حساب الضريبة المعني / دائن نقدية. نفس نمط postPaymentCleared —
 * التسديد بيتم عبر Payment حقيقي (createTaxPayment في الـServer Action)، والدالة دي بترحّل
 * القيد المقابل بس. أنواع الضريبة اللي مالهاش حساب GL مخصص (WithholdingTax/PayrollTax) لسه
 * مؤجَّلة — مسجَّلة في BACKLOG.md. */
/**
 * رصيد ض.ق.م الحقيقي للفترة، محسوب من حركة الدفتر مباشرة (حسابي 1040/2030 — مدخلات/مخرجات).
 * مصدر الحقيقة الوحيد لمبلغ الإقرار — مستخدمة في عرض بطاقة اللوحة وفي `approveVatFilingAction`
 * نفسها، عشان الرقم المعروض والرقم المُسجَّل يبقوا نفس الحساب دايمًا، مش نسختين ممكن ينحرفوا.
 */
export async function computeVatBalance(
  tx: ScopedTx,
  orgId: string,
  periodId: string
): Promise<{ output: Prisma.Decimal; input: Prisma.Decimal }> {
  const vatAccounts = await tx.chartOfAccount.findMany({
    where: { orgId, accountCode: { in: [GL_ACCOUNTS.VAT_INPUT, GL_ACCOUNTS.VAT_OUTPUT] } },
    select: { id: true, accountCode: true },
  });
  const inputAccountId = vatAccounts.find((a) => a.accountCode === GL_ACCOUNTS.VAT_INPUT)?.id;
  const outputAccountId = vatAccounts.find((a) => a.accountCode === GL_ACCOUNTS.VAT_OUTPUT)?.id;

  let output = new Prisma.Decimal(0);
  let input = new Prisma.Decimal(0);
  if (!inputAccountId && !outputAccountId) return { output, input };

  const lines = await tx.journalLine.findMany({
    where: {
      orgId,
      accountId: { in: [inputAccountId, outputAccountId].filter((id): id is string => Boolean(id)) },
      journalEntry: { periodId, status: { in: ["Posted", "Reversed"] } },
    },
    select: { debit: true, credit: true, accountId: true },
  });
  for (const l of lines) {
    if (l.accountId === outputAccountId) output = output.add(l.credit).sub(l.debit);
    if (l.accountId === inputAccountId) input = input.add(l.debit).sub(l.credit);
  }
  return { output, input };
}

export async function postTaxPayment(tx: ScopedTx, taxRecord: TaxRecordForPayment, paymentDate: Date, preparedBy: string): Promise<string> {
  if (taxRecord.taxType !== "VATInput" && taxRecord.taxType !== "VATOutput") {
    throw new Error(`سداد ${taxRecord.taxType} بترحيل تلقائي مش مدعوم لسه — الإقرارات دي بتتسجّل وتتسدد يدويًا بس.`);
  }

  const periodId = await findOpenPeriodFor(tx, taxRecord.orgId, paymentDate);
  const taxAccountKey: GlAccountKey = taxRecord.taxType === "VATInput" ? "VAT_INPUT" : "VAT_OUTPUT";
  const acc = await resolveAccountIds(tx, taxRecord.orgId, [taxAccountKey]);
  acc.CASH = await resolveCashAccountId(tx, taxRecord.orgId, taxRecord.currency);
  const description = `سداد إقرار ${taxRecord.taxType}`;

  return postJournalEntry(tx, {
    orgId: taxRecord.orgId,
    entryDate: paymentDate,
    periodId,
    sourceType: "Automatic",
    sourceModule: "Tax",
    description,
    preparedBy,
    lines: [
      { accountId: acc[taxAccountKey], debit: taxRecord.amount, currency: taxRecord.currency, description, fxRateId: taxRecord.fxRateId },
      { accountId: acc.CASH, credit: taxRecord.amount, currency: taxRecord.currency, description, fxRateId: taxRecord.fxRateId },
    ],
  });
}

export type CommissionEntryForPosting = {
  id: string;
  orgId: string;
  amount: Prisma.Decimal;
  currency: string;
  fxRateId?: string;
};

/**
 * ترحيل سداد عمولة: مدين مصروف عمولات المبيعات (6020) / دائن نقدية (1010).
 * ⚠️ ترحيل مباشر بلا المرور بجدول Payment/BankAccount عمدًا — الدفعة في المشروع مبنية لعميل
 * (companyId) أو مورّد (supplierId) بس، ومفيش مفهوم "دفعة لموظف" (العمولة بتتدفع لمندوب
 * مبيعات، User مش Company/Supplier). نفس الفجوة الموثّقة في docs/ERD.md §11.4 نفسه
 * ("Payroll مؤجَّلة عمدًا لمرحلة تانية"). نفس نمط postFixedAssetAcquisition (قيد مباشر بلا وسيط).
 */
export async function postCommissionPayment(
  tx: ScopedTx,
  entry: CommissionEntryForPosting,
  paymentDate: Date,
  preparedBy: string
): Promise<string> {
  const periodId = await findOpenPeriodFor(tx, entry.orgId, paymentDate);
  const acc = await resolveAccountIds(tx, entry.orgId, ["SALES_COMMISSIONS"]);
  acc.CASH = await resolveCashAccountId(tx, entry.orgId, entry.currency);
  const description = "سداد عمولة مبيعات";

  return postJournalEntry(tx, {
    orgId: entry.orgId,
    entryDate: paymentDate,
    periodId,
    sourceType: "Automatic",
    sourceModule: "Commission",
    description,
    preparedBy,
    lines: [
      { accountId: acc.SALES_COMMISSIONS, debit: entry.amount, currency: entry.currency, description, fxRateId: entry.fxRateId },
      { accountId: acc.CASH, credit: entry.amount, currency: entry.currency, description, fxRateId: entry.fxRateId },
    ],
  });
}
