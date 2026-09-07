"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { withScopedTransaction, getScopedPrisma } from "@/lib/scoped-prisma";
import { requireCurrentUser } from "@/lib/session";
import { requirePermission, getPermissionScope } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { postInvoiceIssued, postPaymentCleared, reverseJournalEntry } from "@/lib/accounting";
import { logError, isNextControlFlowError, businessRuleMessage, isIdempotencyKeyConflict } from "@/lib/errorLog";
import { requireAal2 } from "@/lib/mfa";
import { encryptSecret, updateSecret } from "@/lib/vault";
import { requestEntityCreation } from "@/lib/masterDataChangeRequest";
import { BankAccountSchema } from "@/lib/bankAccountSchema";

// ==================== BankAccount ====================

export type BankAccountFormState = { errors?: Record<string, string[]>; formError?: string; requestSubmitted?: boolean };

/** accountNumber/iban/swift 🔒 بلا واجهة إدخال — نفس نمط Supplier.bankIBAN. */
export async function createBankAccount(_prevState: BankAccountFormState, formData: FormData): Promise<BankAccountFormState> {
  const parsed = BankAccountSchema.safeParse({
    accountName: formData.get("accountName"),
    bankName: formData.get("bankName"),
    currency: formData.get("currency"),
    openingBalance: formData.get("openingBalance") || undefined,
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const user = await requireCurrentUser();

  if (!(await getPermissionScope(user.roleId, "BankAccount", "Create"))) {
    if (!(await getPermissionScope(user.roleId, "MasterDataChangeRequest", "Create"))) {
      return { formError: "معندكش صلاحية إضافة حساب بنكي، ولا صلاحية طلب إضافة." };
    }
    try {
      await withScopedTransaction((tx) =>
        requestEntityCreation(tx, { orgId: user.orgId, userId: user.id, entityType: "BankAccount", proposedChanges: parsed.data })
      );
    } catch (e) {
      if (isNextControlFlowError(e)) throw e;
      await logError({ orgId: user.orgId, userId: user.id, action: "createBankAccount.request", error: e });
      return { formError: "حصل خطأ أثناء تسجيل الطلب — حاول تاني." };
    }
    revalidatePath("/governance/change-requests");
    return { requestSubmitted: true };
  }

  try {
    await requirePermission(user.roleId, "BankAccount", "Create");
    await withScopedTransaction(async (tx) => {
      const account = await tx.bankAccount.create({ data: { orgId: user.orgId, ...parsed.data } });
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "bankAccount.created",
        entityType: "BankAccount",
        entityId: account.id,
        afterValue: { ...parsed.data },
      });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "createBankAccount", error: e });
    return { formError: "حصل خطأ أثناء إضافة الحساب البنكي — حاول تاني." };
  }

  revalidatePath("/accounting/bank-accounts");
  return {};
}

const BankAccountEditSchema = z.object({
  accountName: z.string().trim().min(1, "اسم الحساب مطلوب"),
  bankName: z.string().trim().min(1, "اسم البنك مطلوب"),
});

export type BankAccountEditFormState = { errors?: Record<string, string[]>; formError?: string; success?: boolean };

/** تعديل عام — اسم الحساب/البنك بس. عمدًا مش `currency`/`openingBalance`: الاتنين أساس حساب
 * الرصيد الجاري لكل حركة بنكية مسجَّلة على الحساب ده (نفس نطاق "بلا تعديل بعد الإنشاء" المتبع
 * في `ChartOfAccount`/`AccountingPeriod`) — تغييرهم بعد وجود حركات هيبوّظ كل رصيد تاريخي بصمت،
 * والـTrigger أصلًا بيربط عملة كل حركة بعملة الحساب وقت الإنشاء. `isActive` منفصل تحت. */
export async function updateBankAccountAction(
  bankAccountId: string,
  _prevState: BankAccountEditFormState,
  formData: FormData
): Promise<BankAccountEditFormState> {
  const parsed = BankAccountEditSchema.safeParse({
    accountName: formData.get("accountName"),
    bankName: formData.get("bankName"),
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const user = await requireCurrentUser();
  try {
    await requirePermission(user.roleId, "BankAccount", "Edit");
    await withScopedTransaction(async (tx) => {
      const before = await tx.bankAccount.findUniqueOrThrow({ where: { id: bankAccountId }, select: { accountName: true, bankName: true } });
      await tx.bankAccount.update({ where: { id: bankAccountId }, data: parsed.data });
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "bankAccount.updated",
        entityType: "BankAccount",
        entityId: bankAccountId,
        beforeValue: before,
        afterValue: parsed.data,
      });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "updateBankAccountAction", error: e });
    return { formError: businessRuleMessage(e, "حصل خطأ أثناء تعديل الحساب — حاول تاني.") };
  }

  revalidatePath(`/accounting/bank-accounts/${bankAccountId}`);
  revalidatePath("/accounting/bank-accounts");
  return { success: true };
}

/** تفعيل/تعطيل الحساب — منفصل عن التعديل العام عمدًا (فعل مستقل، مش جزء من فورم تعديل النصوص). */
export async function toggleBankAccountActiveAction(bankAccountId: string) {
  const user = await requireCurrentUser();
  try {
    await requirePermission(user.roleId, "BankAccount", "Edit");
    await withScopedTransaction(async (tx) => {
      const account = await tx.bankAccount.findUniqueOrThrow({ where: { id: bankAccountId }, select: { isActive: true } });
      await tx.bankAccount.update({ where: { id: bankAccountId }, data: { isActive: !account.isActive } });
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "bankAccount.activeToggled",
        entityType: "BankAccount",
        entityId: bankAccountId,
        beforeValue: { isActive: account.isActive },
        afterValue: { isActive: !account.isActive },
      });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "toggleBankAccountActiveAction", error: e });
    throw new Error(businessRuleMessage(e, "حصل خطأ أثناء تغيير حالة الحساب — حاول تاني."));
  }

  revalidatePath(`/accounting/bank-accounts/${bankAccountId}`);
  revalidatePath("/accounting/bank-accounts");
}

const BankAccountBankInfoSchema = z.object({
  accountNumber: z.string().trim().optional().or(z.literal("")),
  iban: z.string().trim().optional().or(z.literal("")),
  swift: z.string().trim().optional().or(z.literal("")),
});

export type BankAccountBankInfoFormState = { errors?: Record<string, string[]>; formError?: string; mfaRequired?: boolean; success?: boolean };

/** أول واجهة إدخال حقيقية لـBankAccount.accountNumberSecretId/ibanSecretId/swiftSecretId (🔒 Vault) —
 * نفس نمط updateSupplierBankInfoAction/updateTransportTripDriverPhoneAction بالحرف: MFA إلزامي،
 * تعديل جزئي آمن (حقل فاضي = يفضل زي ما هو)، القيمة بتتشفّر قبل ما توصل لأي DB. */
export async function updateBankAccountBankInfoAction(
  bankAccountId: string,
  _prevState: BankAccountBankInfoFormState,
  formData: FormData
): Promise<BankAccountBankInfoFormState> {
  const parsed = BankAccountBankInfoSchema.safeParse({
    accountNumber: formData.get("accountNumber") || undefined,
    iban: formData.get("iban") || undefined,
    swift: formData.get("swift") || undefined,
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const { accountNumber, iban, swift } = parsed.data;
  if (!accountNumber && !iban && !swift) return { formError: "دخّل قيمة واحدة على الأقل." };

  const user = await requireCurrentUser();
  try {
    await requirePermission(user.roleId, "BankAccount", "Edit");
  } catch {
    return { formError: "معندكش صلاحية تعديل بيانات الحساب البنكي." };
  }
  try {
    await requireAal2();
  } catch {
    return { formError: "تعديل بيانات بنكية محتاج تحقق بخطوتين (MFA) الأول.", mfaRequired: true };
  }

  try {
    const account = await withScopedTransaction((tx) => tx.bankAccount.findUniqueOrThrow({ where: { id: bankAccountId } }));

    const updates: { accountNumberSecretId?: string; ibanSecretId?: string; swiftSecretId?: string } = {};
    if (accountNumber) {
      updates.accountNumberSecretId = account.accountNumberSecretId
        ? await updateSecret(account.accountNumberSecretId, accountNumber).then(() => account.accountNumberSecretId!)
        : await encryptSecret(accountNumber, `BankAccount ${bankAccountId} accountNumber`);
    }
    if (iban) {
      updates.ibanSecretId = account.ibanSecretId
        ? await updateSecret(account.ibanSecretId, iban).then(() => account.ibanSecretId!)
        : await encryptSecret(iban, `BankAccount ${bankAccountId} iban`);
    }
    if (swift) {
      updates.swiftSecretId = account.swiftSecretId
        ? await updateSecret(account.swiftSecretId, swift).then(() => account.swiftSecretId!)
        : await encryptSecret(swift, `BankAccount ${bankAccountId} swift`);
    }

    await withScopedTransaction(async (tx) => {
      await tx.bankAccount.update({ where: { id: bankAccountId }, data: updates });
      // ممنوع تسجيل القيمة الفعلية في الـAuditLog — بس تسجيل إن التعديل حصل ومين عمله.
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "bankAccount.bankInfoUpdated",
        entityType: "BankAccount",
        entityId: bankAccountId,
        afterValue: { fieldsUpdated: Object.keys(updates) },
      });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "updateBankAccountBankInfoAction", error: e });
    return { formError: businessRuleMessage(e, "حصل خطأ أثناء حفظ البيانات البنكية — حاول تاني.") };
  }

  revalidatePath(`/accounting/bank-accounts/${bankAccountId}`);
  return { success: true };
}

// ==================== Invoice ====================

const INVOICE_TYPES = ["SalesInvoice", "PurchaseInvoice", "CreditNote", "DebitNote", "ProformaInvoice"] as const;

const InvoiceSchema = z.object({
  invoiceType: z.enum(INVOICE_TYPES),
  salesOrderId: z.string().uuid().optional().or(z.literal("")),
  purchaseOrderId: z.string().uuid().optional().or(z.literal("")),
  companyId: z.string().uuid().optional().or(z.literal("")),
  supplierId: z.string().uuid().optional().or(z.literal("")),
  documentId: z.string().uuid().optional().or(z.literal("")),
  currency: z.string().trim().length(3).toUpperCase(),
  subtotal: z.coerce.number().min(0, "الصافي مطلوب"),
  taxAmount: z.coerce.number().min(0).optional(),
  issueDate: z.string().trim().min(1, "تاريخ الإصدار مطلوب"),
  dueDate: z.string().trim().min(1, "تاريخ الاستحقاق مطلوب"),
  notes: z.string().trim().optional().or(z.literal("")),
  idempotencyKey: z.string().uuid().optional().or(z.literal("")),
});

export type InvoiceFormState = { errors?: Record<string, string[]>; formError?: string; invoiceId?: string };

/** totalAmount بيتحسب هنا (مش إدخال) — والـTrigger enforce_invoice_amounts_consistent بيتأكد
 * على مستوى القاعدة إنه = subtotal + taxAmount مهما حصل. ترقيم آمن ضد التزامن بـadvisory lock.
 * idempotencyKey (مفتاح واحد بيتولّد لحظة فتح الفورم، بلا علاقة بمحتواه) بيمنع فاتورة مكرّرة لو
 * المستخدم دبّس "+ فاتورة" مرتين — بيتراجع للفاتورة الأصلية بدل ما يعمل واحدة تانية. */
export async function createInvoice(_prevState: InvoiceFormState, formData: FormData): Promise<InvoiceFormState> {
  const parsed = InvoiceSchema.safeParse({
    invoiceType: formData.get("invoiceType"),
    salesOrderId: formData.get("salesOrderId") || undefined,
    purchaseOrderId: formData.get("purchaseOrderId") || undefined,
    companyId: formData.get("companyId") || undefined,
    supplierId: formData.get("supplierId") || undefined,
    documentId: formData.get("documentId") || undefined,
    currency: formData.get("currency"),
    subtotal: formData.get("subtotal"),
    taxAmount: formData.get("taxAmount") || undefined,
    issueDate: formData.get("issueDate"),
    dueDate: formData.get("dueDate"),
    notes: formData.get("notes") || undefined,
    idempotencyKey: formData.get("idempotencyKey") || undefined,
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const user = await requireCurrentUser();
  const { salesOrderId, purchaseOrderId, companyId, supplierId, documentId, notes, subtotal, taxAmount, issueDate, dueDate, idempotencyKey, ...rest } =
    parsed.data;

  const subtotalDec = new Prisma.Decimal(subtotal);
  const taxDec = new Prisma.Decimal(taxAmount ?? 0);
  const totalDec = subtotalDec.add(taxDec);

  try {
    await requirePermission(user.roleId, "Invoice", "Create");

    // الفحص بعد الصلاحية عمدًا مش قبلها — مستخدم بلا Invoice.Create مايشوفش حتى إن السجل موجود.
    if (idempotencyKey) {
      const scopedPrisma = await getScopedPrisma();
      const existing = await scopedPrisma.invoice.findFirst({ where: { orgId: user.orgId, idempotencyKey }, select: { id: true } });
      if (existing) return { invoiceId: existing.id };
    }

    // companyId/supplierId/documentId اختياريين جايين من الفورم — لازم يتأكدوا إنهم بتوع نفس
    // المنظمة قبل الإنشاء (اتكشف في إعادة مراجعة وحدة 8، 7 سبتمبر). salesOrderId/purchaseOrderId
    // محميين ضمنيًا فعلًا — بيتفحصوا بـ`tx.salesOrder.findUniqueOrThrow`/`tx.purchaseOrder.findUniqueOrThrow`
    // جوه transaction سكوبد تحت، فأي id عابر للمنظمة هيترفض هناك قبل أي كتابة.
    {
      const scopedPrisma = await getScopedPrisma();
      if (companyId) {
        const company = await scopedPrisma.company.findFirst({ where: { id: companyId, deletedAt: null } });
        if (!company) return { formError: "الشركة غير موجودة." };
      }
      if (supplierId) {
        const supplier = await scopedPrisma.supplier.findFirst({ where: { id: supplierId, deletedAt: null } });
        if (!supplier) return { formError: "المورّد غير موجود." };
      }
      if (documentId) {
        const document = await scopedPrisma.document.findFirst({ where: { id: documentId } });
        if (!document) return { formError: "المستند غير موجود." };
      }
    }

    const invoiceId = await withScopedTransaction(async (tx) => {
      const year = new Date(issueDate).getFullYear();
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`INV-${user.orgId}-${year}`}, 0))`;
      const countThisYear = await tx.invoice.count({ where: { orgId: user.orgId, invoiceNumber: { startsWith: `INV-${year}-` } } });
      const invoiceNumber = `INV-${year}-${String(countThisYear + 1).padStart(5, "0")}`;

      // dealId بيتشتق من أمر البيع أو أمر الشراء لو موجود — وسم الأبعاد في القيد بيعتمد عليه
      // (بلاه، تكلفة المشتريات على الصفقة تفضل غير مرئية لأي تجميع بمركز/صفقة، نفس فئة عيب
      // postFixedAssetAcquisition اللي اتصلح في وحدة 8).
      let dealId: string | undefined;
      if (salesOrderId) {
        const so = await tx.salesOrder.findUniqueOrThrow({ where: { id: salesOrderId }, select: { dealId: true } });
        dealId = so.dealId;
      } else if (purchaseOrderId) {
        const po = await tx.purchaseOrder.findUniqueOrThrow({
          where: { id: purchaseOrderId },
          select: { sourcingRequest: { select: { dealId: true } } },
        });
        dealId = po.sourcingRequest.dealId;
      }

      const invoice = await tx.invoice.create({
        data: {
          orgId: user.orgId,
          invoiceNumber,
          salesOrderId: salesOrderId || undefined,
          purchaseOrderId: purchaseOrderId || undefined,
          companyId: companyId || undefined,
          supplierId: supplierId || undefined,
          documentId: documentId || undefined,
          dealId,
          subtotal: subtotalDec,
          taxAmount: taxDec,
          totalAmount: totalDec,
          issueDate: new Date(issueDate),
          dueDate: new Date(dueDate),
          notes: notes || undefined,
          idempotencyKey: idempotencyKey || undefined,
          ...rest,
        },
      });
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "invoice.created",
        entityType: "Invoice",
        entityId: invoice.id,
        afterValue: { invoiceNumber, total: totalDec.toString(), ...rest },
      });
      return invoice.id;
    });

    revalidatePath("/accounting/invoices");
    return { invoiceId };
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    if (idempotencyKey && isIdempotencyKeyConflict(e)) {
      const scopedPrisma = await getScopedPrisma();
      const existing = await scopedPrisma.invoice.findFirst({ where: { orgId: user.orgId, idempotencyKey }, select: { id: true } });
      if (existing) return { invoiceId: existing.id };
    }
    await logError({ orgId: user.orgId, userId: user.id, action: "createInvoice", error: e });
    const message = businessRuleMessage(e, "حصل خطأ أثناء إنشاء الفاتورة — حاول تاني.");
    return { formError: message };
  }
}

/** إصدار الفاتورة — بيرحّل القيد المحاسبي تلقائيًا. ⚠️ Trigger enforce_invoice_eta_validated
 * بيرفض إصدار فاتورة مبيعات بلا مستند ETA معتمد (قيد قانوني مصري، غرامة 20 ألف + 1000 يوميًا). */
export async function issueInvoiceAction(invoiceId: string) {
  const user = await requireCurrentUser();
  await requirePermission(user.roleId, "Invoice", "Edit");

  try {
    await withScopedTransaction(async (tx) => {
      const invoice = await tx.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
      if (invoice.status !== "Draft") throw new Error(`الفاتورة ${invoice.invoiceNumber} حالتها ${invoice.status} — المسودات بس اللي تتصدر.`);

      // البوابة القانونية الأول: تحويل الحالة لـIssued هو اللي بيشغّل Trigger الـETA. لو اتأخرت
      // بعد الترحيل، الـtransaction هترجع صح برضه لكن المستخدم هيشوف رسالة خطأ من الطبقة الغلط.
      await tx.invoice.update({ where: { id: invoiceId }, data: { status: "Issued" } });

      const journalEntryId = await postInvoiceIssued(tx, invoice, user.id);
      await tx.invoice.update({ where: { id: invoiceId }, data: { journalEntryId } });

      // تكامل: أمر البيع بيتحوّل لـInvoiced تلقائيًا (نفس نمط مزامنة Batch.qualityStatus).
      if (invoice.salesOrderId) {
        await tx.salesOrder.update({ where: { id: invoice.salesOrderId }, data: { status: "Invoiced" } });
      }

      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "invoice.issued",
        entityType: "Invoice",
        entityId: invoiceId,
        afterValue: { journalEntryId },
      });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "issueInvoiceAction", error: e });
    throw new Error(businessRuleMessage(e, "حصل خطأ أثناء إصدار الفاتورة."));
  }

  revalidatePath(`/accounting/invoices/${invoiceId}`);
  revalidatePath("/accounting/invoices");
}

/** إلغاء فاتورة مُصدَرة — بيعكس قيدها المحاسبي (مسار التصحيح الشرعي، مش حذف). */
export async function cancelInvoiceAction(invoiceId: string) {
  const user = await requireCurrentUser();
  await requirePermission(user.roleId, "Invoice", "Edit");

  try {
    await withScopedTransaction(async (tx) => {
      const invoice = await tx.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
      if (invoice.status === "Paid") throw new Error("مينفعش إلغاء فاتورة مدفوعة بالكامل — اعمل إشعار دائن.");
      if (invoice.status === "Cancelled") throw new Error("الفاتورة ملغاة بالفعل.");

      if (invoice.journalEntryId) {
        await reverseJournalEntry(tx, { journalEntryId: invoice.journalEntryId, preparedBy: user.id });
      }
      await tx.invoice.update({ where: { id: invoiceId }, data: { status: "Cancelled" } });

      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "invoice.cancelled",
        entityType: "Invoice",
        entityId: invoiceId,
      });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "cancelInvoiceAction", error: e });
    throw new Error(businessRuleMessage(e, "حصل خطأ أثناء إلغاء الفاتورة."));
  }

  revalidatePath(`/accounting/invoices/${invoiceId}`);
  revalidatePath("/accounting/invoices");
}

// ==================== Payment ====================

const PAYMENT_DIRECTIONS = ["Inbound", "Outbound"] as const;
const PAYMENT_METHODS = ["BankTransfer", "Check", "Cash", "LC", "Card"] as const;

const PaymentSchema = z.object({
  direction: z.enum(PAYMENT_DIRECTIONS),
  companyId: z.string().uuid().optional().or(z.literal("")),
  supplierId: z.string().uuid().optional().or(z.literal("")),
  bankAccountId: z.string().uuid("اختر حساب بنكي"),
  amount: z.coerce.number().positive("المبلغ مطلوب"),
  currency: z.string().trim().length(3).toUpperCase(),
  paymentMethod: z.enum(PAYMENT_METHODS),
  paymentDate: z.string().trim().min(1, "تاريخ الدفعة مطلوب"),
  reference: z.string().trim().optional().or(z.literal("")),
  idempotencyKey: z.string().uuid().optional().or(z.literal("")),
});

export type PaymentFormState = { errors?: Record<string, string[]>; formError?: string; paymentId?: string };

export async function createPayment(_prevState: PaymentFormState, formData: FormData): Promise<PaymentFormState> {
  const parsed = PaymentSchema.safeParse({
    direction: formData.get("direction"),
    companyId: formData.get("companyId") || undefined,
    supplierId: formData.get("supplierId") || undefined,
    bankAccountId: formData.get("bankAccountId"),
    amount: formData.get("amount"),
    currency: formData.get("currency"),
    paymentMethod: formData.get("paymentMethod"),
    paymentDate: formData.get("paymentDate"),
    reference: formData.get("reference") || undefined,
    idempotencyKey: formData.get("idempotencyKey") || undefined,
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const user = await requireCurrentUser();
  const { companyId, supplierId, reference, paymentDate, idempotencyKey, ...rest } = parsed.data;

  try {
    await requirePermission(user.roleId, "Payment", "Create");

    // bankAccountId إلزامي وبيتعرض بلا `?.` في `/accounting/payments`/`payments/[id]`
    // (`p.bankAccount.accountName`/`payment.bankAccount.accountName`) — لازم يتحقق قبل الإنشاء
    // (اتكشف في مراجعة وحدة 8، 6 سبتمبر).
    const scopedPrisma = await getScopedPrisma();
    const bankAccount = await scopedPrisma.bankAccount.findFirst({ where: { id: rest.bankAccountId } });
    if (!bankAccount) return { formError: "الحساب البنكي غير موجود." };
    // companyId/supplierId اختياريين جايين من الفورم — لازم يتأكدوا إنهم بتوع نفس المنظمة قبل
    // الإنشاء (اتكشف في إعادة مراجعة وحدة 8، 7 سبتمبر).
    if (companyId) {
      const company = await scopedPrisma.company.findFirst({ where: { id: companyId, deletedAt: null } });
      if (!company) return { formError: "الشركة غير موجودة." };
    }
    if (supplierId) {
      const supplier = await scopedPrisma.supplier.findFirst({ where: { id: supplierId, deletedAt: null } });
      if (!supplier) return { formError: "المورّد غير موجود." };
    }

    // الفحص بعد الصلاحية عمدًا مش قبلها — مستخدم بلا Payment.Create مايشوفش حتى إن السجل موجود.
    if (idempotencyKey) {
      const scopedPrisma = await getScopedPrisma();
      const existing = await scopedPrisma.payment.findFirst({ where: { orgId: user.orgId, idempotencyKey }, select: { id: true } });
      if (existing) return { paymentId: existing.id };
    }

    const paymentId = await withScopedTransaction(async (tx) => {
      const year = new Date(paymentDate).getFullYear();
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`PAY-${user.orgId}-${year}`}, 0))`;
      const countThisYear = await tx.payment.count({ where: { orgId: user.orgId, paymentNumber: { startsWith: `PAY-${year}-` } } });
      const paymentNumber = `PAY-${year}-${String(countThisYear + 1).padStart(5, "0")}`;

      const payment = await tx.payment.create({
        data: {
          orgId: user.orgId,
          paymentNumber,
          companyId: companyId || undefined,
          supplierId: supplierId || undefined,
          reference: reference || undefined,
          paymentDate: new Date(paymentDate),
          createdBy: user.id,
          idempotencyKey: idempotencyKey || undefined,
          ...rest,
        },
      });
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "payment.created",
        entityType: "Payment",
        entityId: payment.id,
        afterValue: { paymentNumber, ...rest },
      });
      return payment.id;
    });

    revalidatePath("/accounting/payments");
    return { paymentId };
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    if (idempotencyKey && isIdempotencyKeyConflict(e)) {
      const scopedPrisma = await getScopedPrisma();
      const existing = await scopedPrisma.payment.findFirst({ where: { orgId: user.orgId, idempotencyKey }, select: { id: true } });
      if (existing) return { paymentId: existing.id };
    }
    await logError({ orgId: user.orgId, userId: user.id, action: "createPayment", error: e });
    return { formError: businessRuleMessage(e, "حصل خطأ أثناء تسجيل الدفعة — حاول تاني.") };
  }
}

/** تحصيل/سداد الدفعة — بيرحّل القيد المحاسبي، والـTrigger بيزامن حالات الفواتير المخصَّصة تلقائيًا.
 * approvedBy بيتسجّل هنا — أساس قاعدة فصل المهام لما وحدة 9 تتبني. */
export async function clearPaymentAction(paymentId: string) {
  const user = await requireCurrentUser();
  await requirePermission(user.roleId, "Payment", "Edit");

  try {
    await withScopedTransaction(async (tx) => {
      const payment = await tx.payment.findUniqueOrThrow({ where: { id: paymentId } });
      if (payment.status !== "Pending") throw new Error(`الدفعة ${payment.paymentNumber} حالتها ${payment.status} — المعلّقة بس اللي تتحصّل.`);

      const journalEntryId = await postPaymentCleared(tx, payment, user.id);
      await tx.payment.update({ where: { id: paymentId }, data: { status: "Cleared", journalEntryId, approvedBy: user.id } });

      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "payment.cleared",
        entityType: "Payment",
        entityId: paymentId,
        afterValue: { journalEntryId },
      });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "clearPaymentAction", error: e });
    throw new Error(businessRuleMessage(e, "حصل خطأ أثناء تحصيل الدفعة."));
  }

  revalidatePath(`/accounting/payments/${paymentId}`);
  revalidatePath("/accounting/payments");
  revalidatePath("/accounting/invoices");
}

/** ارتداد الدفعة — بيعكس قيدها، والـTrigger بيرجّع حالات الفواتير المخصَّصة تلقائيًا. */
export async function bouncePaymentAction(paymentId: string) {
  const user = await requireCurrentUser();
  await requirePermission(user.roleId, "Payment", "Edit");

  try {
    await withScopedTransaction(async (tx) => {
      const payment = await tx.payment.findUniqueOrThrow({ where: { id: paymentId } });
      if (payment.status !== "Cleared") throw new Error(`الدفعة ${payment.paymentNumber} حالتها ${payment.status} — المحصّلة بس اللي ترتد.`);

      if (payment.journalEntryId) {
        await reverseJournalEntry(tx, { journalEntryId: payment.journalEntryId, preparedBy: user.id });
      }
      await tx.payment.update({ where: { id: paymentId }, data: { status: "Bounced" } });

      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "payment.bounced",
        entityType: "Payment",
        entityId: paymentId,
      });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "bouncePaymentAction", error: e });
    throw new Error(businessRuleMessage(e, "حصل خطأ أثناء تسجيل ارتداد الدفعة."));
  }

  revalidatePath(`/accounting/payments/${paymentId}`);
  revalidatePath("/accounting/payments");
  revalidatePath("/accounting/invoices");
}

// ==================== PaymentAllocation ====================

const AllocationSchema = z.object({
  invoiceId: z.string().uuid("اختر فاتورة"),
  allocatedAmount: z.coerce.number().positive("المبلغ مطلوب"),
});

export type AllocationFormState = { errors?: Record<string, string[]>; formError?: string };

/** ⚠️ الحدود (تخصيص زائد على الفاتورة أو الدفعة، وتخصيص عابر العملات) مفروضة بـTrigger على مستوى
 * القاعدة — التحقق هنا مش موجود عمدًا عشان يفضل مصدر واحد للحقيقة. */
export async function createPaymentAllocation(paymentId: string, _prevState: AllocationFormState, formData: FormData): Promise<AllocationFormState> {
  const parsed = AllocationSchema.safeParse({
    invoiceId: formData.get("invoiceId"),
    allocatedAmount: formData.get("allocatedAmount"),
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const user = await requireCurrentUser();
  try {
    await requirePermission(user.roleId, "Payment", "Edit");
    // ده تحقق وجود/عضوية منظمة بس (مختلف عن حدود المبلغ اللي الـTrigger مسؤول عنها فوق) —
    // invoiceId بيتعرض بلا `?.` في `/accounting/payments/[id]` (`a.invoice.invoiceNumber`)،
    // فأي id عابر للمنظمة كان هيكسر الصفحة (اتكشف في مراجعة وحدة 8، 6 سبتمبر).
    const scopedPrisma = await getScopedPrisma();
    const invoice = await scopedPrisma.invoice.findFirst({ where: { id: parsed.data.invoiceId } });
    if (!invoice) return { formError: "الفاتورة غير موجودة." };
    await withScopedTransaction(async (tx) => {
      const allocation = await tx.paymentAllocation.create({
        data: { orgId: user.orgId, paymentId, ...parsed.data },
      });
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "paymentAllocation.created",
        entityType: "PaymentAllocation",
        entityId: allocation.id,
        afterValue: { paymentId, ...parsed.data },
      });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "createPaymentAllocation", error: e });
    return { formError: businessRuleMessage(e, "حصل خطأ أثناء التخصيص — حاول تاني.") };
  }

  revalidatePath(`/accounting/payments/${paymentId}`);
  revalidatePath("/accounting/invoices");
  return {};
}

/** ربط مستند ETA بفاتورة مسودة. لازم يكون إجراء منفصل عن الإنشاء لأن المستند القانوني غالبًا
 * بيتعمد من بوابة الضرائب بعد ما الفاتورة اتجهزت — من غير ده الفاتورة تفضل حبيسة المسودة. */
export async function linkInvoiceDocumentAction(invoiceId: string, documentId: string) {
  const user = await requireCurrentUser();
  await requirePermission(user.roleId, "Invoice", "Edit");

  try {
    await withScopedTransaction(async (tx) => {
      const invoice = await tx.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
      if (invoice.status !== "Draft") throw new Error("المستند القانوني بيتربط بالمسودات بس — الفاتورة اتصدرت خلاص.");

      // documentId جاي من الفورم — لازم يتأكد إنه فعلًا بتاع نفس المنظمة قبل الربط (اتكشف في
      // إعادة مراجعة وحدة 8، 7 سبتمبر).
      const document = await tx.document.findFirst({ where: { id: documentId } });
      if (!document) throw new Error("المستند غير موجود.");

      await tx.invoice.update({ where: { id: invoiceId }, data: { documentId } });
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "invoice.documentLinked",
        entityType: "Invoice",
        entityId: invoiceId,
        afterValue: { documentId },
      });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "linkInvoiceDocumentAction", error: e });
    throw new Error(businessRuleMessage(e, "حصل خطأ أثناء ربط المستند."));
  }

  revalidatePath(`/accounting/invoices/${invoiceId}`);
}
