"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { withScopedTransaction, getScopedPrisma } from "@/lib/scoped-prisma";
import { requireCurrentUser } from "@/lib/session";
import { requirePermission, getPermissionScope } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { notifySoDViolationAttempt } from "@/lib/notification";
import { postInvoiceIssued, postPaymentCleared, postPaymentAllocated, reverseJournalEntry } from "@/lib/accounting";
import { accrueCommissionOnCollection } from "@/lib/commissionEngine";
import { logError, isNextControlFlowError, businessRuleMessage, isIdempotencyKeyConflict } from "@/lib/errorLog";
import { requireAal2 } from "@/lib/mfa";
import { encryptSecret, updateSecret } from "@/lib/vault";
import { requestEntityCreation } from "@/lib/masterDataChangeRequest";
import { BankAccountSchema } from "@/lib/bankAccountSchema";
import { currencySchema } from "@/lib/currencySchema";
import { businessYear } from "@/lib/format";

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
  invoiceType: z.enum(INVOICE_TYPES, "اختار نوع فاتورة صحيح"),
  salesOrderId: z.string().uuid().optional().or(z.literal("")),
  purchaseOrderId: z.string().uuid().optional().or(z.literal("")),
  companyId: z.string().uuid().optional().or(z.literal("")),
  supplierId: z.string().uuid().optional().or(z.literal("")),
  documentId: z.string().uuid().optional().or(z.literal("")),
  currency: currencySchema,
  // ⚠️ مفيش subtotal/taxAmount هنا عمدًا: الإجماليات بقت مشتقّة من InvoiceLine بـTrigger
  // sync_invoice_totals_from_lines (هجرة 20260929100000). أي رقم يتبعت من الفورم هيتكتب
  // فوقه في القاعدة أول ما يتضاف بند، فقبوله في الفورم كان هيبقى وعد كاذب للمستخدم.
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
    issueDate: formData.get("issueDate"),
    dueDate: formData.get("dueDate"),
    notes: formData.get("notes") || undefined,
    idempotencyKey: formData.get("idempotencyKey") || undefined,
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const user = await requireCurrentUser();
  const { salesOrderId, purchaseOrderId, companyId, supplierId, documentId, notes, issueDate, dueDate, idempotencyKey, ...rest } =
    parsed.data;

  // الفاتورة بتتولد بأصفار كمسودة، والبنود هي اللي بتحدّد الإجماليات بعد كده (Trigger).
  const ZERO = new Prisma.Decimal(0);

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
      const year = businessYear(issueDate);
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`INV-${user.orgId}-${year}`}, 0))`;
      const countThisYear = await tx.invoice.count({ where: { orgId: user.orgId, invoiceNumber: { startsWith: `INV-${year}-` } } });
      const invoiceNumber = `INV-${year}-${String(countThisYear + 1).padStart(5, "0")}`;

      // dealId بيتشتق من أمر البيع أو أمر الشراء لو موجود — وسم الأبعاد في القيد بيعتمد عليه
      // (بلاه، تكلفة المشتريات على الصفقة تفضل غير مرئية لأي تجميع بمركز/صفقة، نفس فئة عيب
      // postFixedAssetAcquisition اللي اتصلح في وحدة 8).
      let dealId: string | undefined;
      // بنود أمر البيع بتتنسخ كبنود فاتورة — أهم مصدر للبنود وأقل إدخال يدوي = أقل خطأ.
      let defaultUnit = "kg";
      let soLines: { productId: string; quantity: Prisma.Decimal; unitPrice: Prisma.Decimal; product: { nameAr: string; hsCode: string | null; originCountry: string | null } }[] = [];
      if (salesOrderId) {
        const so = await tx.salesOrder.findUniqueOrThrow({
          where: { id: salesOrderId },
          select: {
            dealId: true,
            // وحدة التسعير بتيجي من عرض السعر المقبول للصفقة (مفيش unit على Product ولا على
            // SalesOrderLine) — والمستخدم يقدر يعدّلها على البند نفسه لو البند مش بنفس الوحدة.
            deal: { select: { quotes: { where: { status: "Accepted" }, orderBy: { version: "desc" }, take: 1, select: { priceUnit: true } } } },
            lines: {
              orderBy: { createdAt: "asc" },
              select: {
                productId: true,
                quantity: true,
                unitPrice: true,
                product: { select: { nameAr: true, hsCode: true, originCountry: true } },
              },
            },
          },
        });
        dealId = so.dealId;
        soLines = so.lines;
        defaultUnit = so.deal.quotes[0]?.priceUnit || "kg";
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
          subtotal: ZERO,
          taxAmount: ZERO,
          totalAmount: ZERO,
          issueDate: new Date(issueDate),
          dueDate: new Date(dueDate),
          notes: notes || undefined,
          idempotencyKey: idempotencyKey || undefined,
          ...rest,
        },
      });

      // createMany مش بيشغّل الـTriggers صف-بصف بشكل مضمون في كل مسارات Prisma، وإحنا
      // معتمدين عليهم في حساب lineTotal — فالإنشاء فردي عمدًا. عدد بنود أمر بيع واحد صغير.
      for (const [i, line] of soLines.entries()) {
        await tx.invoiceLine.create({
          data: {
            orgId: user.orgId,
            invoiceId: invoice.id,
            lineNumber: i + 1,
            productId: line.productId,
            description: line.product.nameAr,
            hsCode: line.product.hsCode,
            countryOfOrigin: line.product.originCountry,
            quantity: line.quantity,
            unit: defaultUnit,
            unitPrice: line.unitPrice,
            lineTotal: ZERO, // بيتحسب في القاعدة
            lineTax: ZERO, // بيتحسب في القاعدة
          },
        });
      }

      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "invoice.created",
        entityType: "Invoice",
        entityId: invoice.id,
        afterValue: { invoiceNumber, linesFromSalesOrder: soLines.length, ...rest },
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

// ==================== بنود الفاتورة (InvoiceLine) ====================

const InvoiceLineSchema = z.object({
  invoiceId: z.string().uuid(),
  productId: z.string().uuid().optional().or(z.literal("")),
  description: z.string().trim().min(1, "وصف الصنف مطلوب"),
  hsCode: z.string().trim().optional().or(z.literal("")),
  countryOfOrigin: z.string().trim().optional().or(z.literal("")),
  quantity: z.coerce.number().positive("الكمية لازم تكون أكبر من صفر"),
  unit: z.string().trim().min(1, "الوحدة مطلوبة"),
  unitPrice: z.coerce.number().min(0, "سعر الوحدة لازم يكون 0 أو أكتر"),
  taxRatePct: z.coerce.number().min(0).max(100, "نسبة الضريبة بين 0 و100").optional(),
  netWeightKg: z.coerce.number().min(0).optional(),
});

export type InvoiceLineFormState = { errors?: Record<string, string[]>; formError?: string; ok?: boolean };

/** ⚠️ lineTotal/lineTax مش بيتبعتوا من هنا — الـTrigger compute_invoice_line_amounts بيحسبهم
 * في القاعدة، وsync_invoice_totals_from_lines بيحدّث إجماليات الفاتورة بعدها. الأصفار اللي
 * بتتبعت تحت قيم مؤقتة عشان الأعمدة NOT NULL بس، وبتتكتب فوقها فورًا. */
export async function addInvoiceLine(_prev: InvoiceLineFormState, formData: FormData): Promise<InvoiceLineFormState> {
  const parsed = InvoiceLineSchema.safeParse({
    invoiceId: formData.get("invoiceId"),
    productId: formData.get("productId") || undefined,
    description: formData.get("description"),
    hsCode: formData.get("hsCode") || undefined,
    countryOfOrigin: formData.get("countryOfOrigin") || undefined,
    quantity: formData.get("quantity"),
    unit: formData.get("unit"),
    unitPrice: formData.get("unitPrice"),
    taxRatePct: formData.get("taxRatePct") || undefined,
    netWeightKg: formData.get("netWeightKg") || undefined,
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const user = await requireCurrentUser();
  const { invoiceId, productId, ...line } = parsed.data;
  const ZERO = new Prisma.Decimal(0);

  try {
    await requirePermission(user.roleId, "Invoice", "Edit");

    await withScopedTransaction(async (tx) => {
      // findUniqueOrThrow جوه transaction سكوبد = فاتورة من منظمة تانية هترفض هنا قبل أي كتابة.
      const invoice = await tx.invoice.findUniqueOrThrow({ where: { id: invoiceId }, select: { id: true, invoiceNumber: true } });
      if (productId) {
        const product = await tx.product.findFirst({ where: { id: productId, deletedAt: null }, select: { id: true } });
        if (!product) throw new Error("المنتج غير موجود.");
      }

      // ترقيم البند داخل الفاتورة — قفل على الفاتورة عشان مستخدمين متوازيين ما ياخدوش نفس الرقم.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`INVLINE-${invoiceId}`}, 0))`;
      const max = await tx.invoiceLine.aggregate({ where: { invoiceId }, _max: { lineNumber: true } });

      const created = await tx.invoiceLine.create({
        data: {
          orgId: user.orgId,
          invoiceId,
          lineNumber: (max._max.lineNumber ?? 0) + 1,
          productId: productId || undefined,
          hsCode: line.hsCode || undefined,
          countryOfOrigin: line.countryOfOrigin || undefined,
          description: line.description,
          quantity: line.quantity,
          unit: line.unit,
          unitPrice: line.unitPrice,
          taxRatePct: line.taxRatePct ?? 0,
          netWeightKg: line.netWeightKg,
          lineTotal: ZERO,
          lineTax: ZERO,
        },
      });

      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "invoiceLine.created",
        entityType: "InvoiceLine",
        entityId: created.id,
        afterValue: { invoiceNumber: invoice.invoiceNumber, description: line.description, quantity: String(line.quantity), unitPrice: String(line.unitPrice) },
      });
    });

    revalidatePath(`/accounting/invoices/${invoiceId}`);
    return { ok: true };
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "addInvoiceLine", error: e });
    return { formError: businessRuleMessage(e, "حصل خطأ أثناء إضافة البند — حاول تاني.") };
  }
}

/** حذف بند — الـTrigger enforce_invoice_lines_draft_only بيرفضه لو الفاتورة مش مسودة،
 * وsync_invoice_totals_from_lines بيرجّع الإجماليات تلقائيًا بعد الحذف. */
export async function deleteInvoiceLine(lineId: string) {
  const user = await requireCurrentUser();
  await requirePermission(user.roleId, "Invoice", "Edit");

  try {
    const invoiceId = await withScopedTransaction(async (tx) => {
      const line = await tx.invoiceLine.findUniqueOrThrow({
        where: { id: lineId },
        select: { id: true, invoiceId: true, description: true, lineTotal: true },
      });
      await tx.invoiceLine.delete({ where: { id: lineId } });
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "invoiceLine.deleted",
        entityType: "InvoiceLine",
        entityId: line.id,
        beforeValue: { description: line.description, lineTotal: line.lineTotal.toString() },
      });
      return line.invoiceId;
    });

    revalidatePath(`/accounting/invoices/${invoiceId}`);
    return { ok: true as const };
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "deleteInvoiceLine", error: e });
    return { ok: false as const, error: businessRuleMessage(e, "حصل خطأ أثناء حذف البند.") };
  }
}

/** إصدار الفاتورة — بيرحّل القيد المحاسبي تلقائيًا. ⚠️ Trigger enforce_invoice_eta_validated
 * بيرفض إصدار فاتورة مبيعات بلا مستند ETA معتمد (قيد قانوني مصري، غرامة 20 ألف + 1000 يوميًا). */
/** fxRate مطلوب بس لو Organization.functionalCurrency مفعّلة وعملة الفاتورة مختلفة عنها —
 * بيتحوَّل لـExchangeRate جديد (baseCurrency=عملة الفاتورة، quoteCurrency=العملة الوظيفية)
 * ويتسجّل على بند AR/AP نفسه، نفس نمط CostItem.fxRate بالحرف. سعر الإصدار ده هو اللي هيتقارن
 * بسعر التحصيل وقت التخصيص الفعلي لحساب فرق العملة المحقَّق (postPaymentAllocated). */
export async function issueInvoiceAction(invoiceId: string, fxRate?: string) {
  const user = await requireCurrentUser();
  await requirePermission(user.roleId, "Invoice", "Edit");

  try {
    await withScopedTransaction(async (tx) => {
      const invoice = await tx.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
      if (invoice.status !== "Draft") throw new Error(`الفاتورة ${invoice.invoiceNumber} حالتها ${invoice.status} — المسودات بس اللي تتصدر.`);

      const org = await tx.organization.findUniqueOrThrow({ where: { id: user.orgId }, select: { functionalCurrency: true } });
      const needsFxRate = !!org.functionalCurrency && invoice.currency !== org.functionalCurrency;
      if (needsFxRate && !fxRate) throw new Error(`الفاتورة بعملة ${invoice.currency} مختلفة عن عملة المنظمة الوظيفية (${org.functionalCurrency}) — لازم سعر صرف.`);
      let fxRateId: string | undefined;
      if (needsFxRate && fxRate) {
        const exchangeRate = await tx.exchangeRate.create({
          data: { orgId: user.orgId, baseCurrency: invoice.currency, quoteCurrency: org.functionalCurrency!, rate: fxRate, rateDate: invoice.issueDate, rateType: "Spot" },
        });
        fxRateId = exchangeRate.id;
      }

      // البوابة القانونية الأول: تحويل الحالة لـIssued هو اللي بيشغّل Trigger الـETA. لو اتأخرت
      // بعد الترحيل، الـtransaction هترجع صح برضه لكن المستخدم هيشوف رسالة خطأ من الطبقة الغلط.
      await tx.invoice.update({ where: { id: invoiceId }, data: { status: "Issued" } });

      const journalEntryId = await postInvoiceIssued(tx, { ...invoice, fxRateId }, user.id);
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
  direction: z.enum(PAYMENT_DIRECTIONS, "اختار اتجاه دفعة صحيح"),
  companyId: z.string().uuid().optional().or(z.literal("")),
  supplierId: z.string().uuid().optional().or(z.literal("")),
  bankAccountId: z.string().uuid("اختر حساب بنكي"),
  amount: z.coerce.number().positive("المبلغ مطلوب"),
  currency: currencySchema,
  paymentMethod: z.enum(PAYMENT_METHODS, "اختار طريقة دفع صحيحة"),
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
      const year = businessYear(paymentDate);
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
 * approvedBy بيتسجّل هنا — أساس قاعدة فصل المهام لما وحدة 9 تتبني. fxRate مطلوب بس لو
 * Organization.functionalCurrency مفعّلة وعملة الدفعة مختلفة عنها — راجع تعليق issueInvoiceAction. */
export async function clearPaymentAction(paymentId: string, fxRate?: string) {
  const user = await requireCurrentUser();
  await requirePermission(user.roleId, "Payment", "Edit");

  try {
    await withScopedTransaction(async (tx) => {
      const payment = await tx.payment.findUniqueOrThrow({ where: { id: paymentId } });
      if (payment.status !== "Pending") throw new Error(`الدفعة ${payment.paymentNumber} حالتها ${payment.status} — المعلّقة بس اللي تتحصّل.`);

      const org = await tx.organization.findUniqueOrThrow({ where: { id: user.orgId }, select: { functionalCurrency: true } });
      const needsFxRate = !!org.functionalCurrency && payment.currency !== org.functionalCurrency;
      if (needsFxRate && !fxRate) throw new Error(`الدفعة بعملة ${payment.currency} مختلفة عن عملة المنظمة الوظيفية (${org.functionalCurrency}) — لازم سعر صرف.`);
      let fxRateId: string | undefined;
      if (needsFxRate && fxRate) {
        const exchangeRate = await tx.exchangeRate.create({
          data: { orgId: user.orgId, baseCurrency: payment.currency, quoteCurrency: org.functionalCurrency!, rate: fxRate, rateDate: payment.paymentDate, rateType: "Spot" },
        });
        fxRateId = exchangeRate.id;
      }

      const journalEntryId = await postPaymentCleared(tx, { ...payment, fxRateId }, user.id);
      await tx.payment.update({ where: { id: paymentId }, data: { status: "Cleared", journalEntryId, approvedBy: user.id } });

      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "payment.cleared",
        entityType: "Payment",
        entityId: paymentId,
        afterValue: { journalEntryId },
      });

      // التخصيصات اللي كانت موجودة قبل التحصيل ده — المسار العكسي (تخصيص لدفعة محصّلة بالفعل)
      // بيتغطّى في createPaymentAllocation تحت. postPaymentAllocated بترجع null بأمان لو
      // functionalCurrency مش مفعّلة أو مفيش فرق عملة ممكن (نفس عملة المنظمة).
      const allocations = await tx.paymentAllocation.findMany({
        where: { paymentId },
        include: { invoice: { select: { dealId: true } } },
      });
      for (const allocation of allocations) {
        const journalEntryId = await postPaymentAllocated(
          tx,
          { orgId: user.orgId, paymentId, invoiceId: allocation.invoiceId, allocatedAmount: allocation.allocatedAmount, allocationDate: new Date() },
          user.id
        );
        if (journalEntryId) {
          await tx.paymentAllocation.update({ where: { id: allocation.id }, data: { journalEntryId } });
        }
        if (payment.direction === "Inbound") {
          await accrueCommissionOnCollection(tx, {
            orgId: user.orgId,
            dealId: allocation.invoice.dealId,
            allocatedAmount: Number(allocation.allocatedAmount),
            currency: payment.currency,
            performedByUserId: user.id,
            paymentAllocationId: allocation.id,
          });
        }
      }
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "clearPaymentAction", error: e });
    // فصل المهام: الترايجر رفض الكتابة نفسها (RAISE EXCEPTION، مفيش صف اتحفظ) — المستخدم شاف
    // الرسالة فورًا تحت، لكن لمين بيدير قواعد فصل المهام لازم يلاحظوا محاولة تجاوز حقيقية حصلت.
    // best-effort — فشل الإشعار (نادر) مايمنعش رسالة الرفض الأصلية توصل للمستخدم.
    if (e instanceof Error && e.message.includes("فصل المهام مفعّل")) {
      try {
        const scopedPrisma = await getScopedPrisma();
        const payment = await scopedPrisma.payment.findUnique({ where: { id: paymentId }, select: { paymentNumber: true } });
        await withScopedTransaction((tx) =>
          notifySoDViolationAttempt(tx, {
            orgId: user.orgId,
            attemptedByUserId: user.id,
            attemptedByUserName: user.fullName,
            entityType: "Payment",
            entityLabel: `يعتمد دفعة ${payment?.paymentNumber ?? paymentId} وهو نفسه منشئها/منشئ موردها`,
          })
        );
      } catch {
        // تجاهل — راجع التعليق فوق
      }
    }
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
      const payment = await tx.payment.findUniqueOrThrow({ where: { id: paymentId }, include: { allocations: { select: { id: true } } } });
      if (payment.status !== "Cleared") throw new Error(`الدفعة ${payment.paymentNumber} حالتها ${payment.status} — المحصّلة بس اللي ترتد.`);
      // ⚠️ لو الدفعة اتخصّصت بالفعل على فاتورة (postPaymentAllocated)، عكس قيد التحصيل الأصلي
      // بس مش كافي — قيد التخصيص (اللي فرّج عن AR/AP فعليًا وحسب فرق العملة) هيفضل واقف من غير
      // عكس مقابل، وحساب "دفعات معلَّقة" هيفضل غير متزن نهائيًا. الأسلم رفض الارتداد لحد ما
      // التخصيصات تتشال أولًا (عبر deletePaymentAllocationAction تحت) — بدل عكس تلقائي هنا قد
      // يتعارض مع تخصيصات جزئية على فواتير مختلفة.
      if (payment.allocations.length > 0) {
        throw new Error(`الدفعة ${payment.paymentNumber} اتخصّصت بالفعل على ${payment.allocations.length} فاتورة — لازم تلغي التخصيصات دي الأول (زرار "إلغاء التخصيص" جوه كل فاتورة) قبل ما ترتد.`);
      }

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
    const payment = await scopedPrisma.payment.findFirst({ where: { id: paymentId } });
    if (!payment) return { formError: "الدفعة غير موجودة." };
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
      // الدفعة كانت محصّلة بالفعل قبل التخصيص ده (ترتيب نادر بس ممكن) — العكس (تخصيص لدفعة
      // معلّقة، بعدين تتحصّل) بيتغطّى من clearPaymentAction تحت، مش هنا.
      if (payment.status === "Cleared") {
        const journalEntryId = await postPaymentAllocated(
          tx,
          { orgId: user.orgId, paymentId, invoiceId: parsed.data.invoiceId, allocatedAmount: new Prisma.Decimal(parsed.data.allocatedAmount), allocationDate: new Date() },
          user.id
        );
        if (journalEntryId) {
          await tx.paymentAllocation.update({ where: { id: allocation.id }, data: { journalEntryId } });
        }
        if (payment.direction === "Inbound") {
          await accrueCommissionOnCollection(tx, {
            orgId: user.orgId,
            dealId: invoice.dealId,
            allocatedAmount: parsed.data.allocatedAmount,
            currency: payment.currency,
            performedByUserId: user.id,
            paymentAllocationId: allocation.id,
          });
        }
      }
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

/** إلغاء تخصيص دفعة على فاتورة — بند من BACKLOG.md § وحدة 8 ("مفيش فعل إلغاء تخصيص دفعة").
 * لازم قبل أي ارتداد لدفعة اتخصّصت بالفعل (راجع bouncePaymentAction فوق). بيعكس قيد فرق العملة
 * اللي اتسجّل وقت التخصيص (لو موجود)، وبيشيل أي عمولة اتسجّلت تلقائيًا نتيجة التخصيص ده لسه
 * Accrued — لو أي عمولة اتاعتمدت أو اتدفعت بالفعل، الإلغاء يترفض صراحة بدل ما يمسح أثر مالي
 * حقيقي بصمت. حذف صف PaymentAllocation نفسه بيخلّي Trigger sync_invoice_payment_status
 * يعيد حساب Invoice.amountPaid/status تلقائيًا (نفس التريجر اللي بيديره وقت الإنشاء). */
export async function deletePaymentAllocationAction(allocationId: string) {
  const user = await requireCurrentUser();
  await requirePermission(user.roleId, "Payment", "Edit");

  let paymentId: string | undefined;
  try {
    await withScopedTransaction(async (tx) => {
      const allocation = await tx.paymentAllocation.findFirstOrThrow({
        where: { id: allocationId, orgId: user.orgId },
        include: { commissionEntries: { select: { id: true, status: true } } },
      });
      paymentId = allocation.paymentId;

      const nonAccrued = allocation.commissionEntries.filter((c) => c.status !== "Accrued");
      if (nonAccrued.length > 0) {
        throw new Error("في عمولة اتخصمت أو اتدفعت مبنية على التخصيص ده — مينفعش يتلغى قبل ما تتراجع العمولة نفسها الأول.");
      }

      for (const c of allocation.commissionEntries) {
        await tx.commissionEntry.delete({ where: { id: c.id } });
        await logAudit(tx, {
          orgId: user.orgId,
          userId: user.id,
          action: "commissionEntry.removedOnUnallocate",
          entityType: "CommissionEntry",
          entityId: c.id,
          beforeValue: { paymentAllocationId: allocationId },
        });
      }

      if (allocation.journalEntryId) {
        await reverseJournalEntry(tx, { journalEntryId: allocation.journalEntryId, preparedBy: user.id });
      }

      await tx.paymentAllocation.delete({ where: { id: allocationId } });
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "paymentAllocation.deleted",
        entityType: "PaymentAllocation",
        entityId: allocationId,
        beforeValue: { paymentId: allocation.paymentId, invoiceId: allocation.invoiceId, allocatedAmount: allocation.allocatedAmount.toString() },
      });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "deletePaymentAllocationAction", error: e });
    throw new Error(businessRuleMessage(e, "حصل خطأ أثناء إلغاء التخصيص."));
  }

  if (paymentId) revalidatePath(`/accounting/payments/${paymentId}`);
  revalidatePath("/accounting/payments");
  revalidatePath("/accounting/invoices");
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
