"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { getScopedPrisma, withScopedTransaction } from "@/lib/scoped-prisma";
import { requireCurrentUser } from "@/lib/session";
import { requirePermission } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { logError, isNextControlFlowError } from "@/lib/errorLog";

const SourcingRequestSchema = z.object({
  specificationId: z.string().uuid().optional().or(z.literal("")),
  rawQuantityRequired: z.coerce.number().min(0).optional(),
  saleableQuantityRequired: z.coerce.number().min(0).optional(),
  maximumPurchasePrice: z.coerce.number().positive("الحد الأقصى للسعر مطلوب"),
  targetPurchasePrice: z.coerce.number().min(0).optional(),
  currency: z.string().trim().min(1, "العملة مطلوبة"),
  requiredCargoReadyDate: z.string().trim().optional().or(z.literal("")),
});

export type SourcingRequestFormState = { errors?: Record<string, string[]>; formError?: string };

/** بينشئ طلب توريد لصفقة (productId/marketId بيتشتقوا من الصفقة، مش إدخال مستخدم) — نفس نمط
 * createComplianceCase/createShipment بالظبط. */
export async function createSourcingRequest(
  dealId: string,
  _prevState: SourcingRequestFormState,
  formData: FormData
): Promise<SourcingRequestFormState> {
  const parsed = SourcingRequestSchema.safeParse({
    specificationId: formData.get("specificationId") || undefined,
    rawQuantityRequired: formData.get("rawQuantityRequired") || undefined,
    saleableQuantityRequired: formData.get("saleableQuantityRequired") || undefined,
    maximumPurchasePrice: formData.get("maximumPurchasePrice"),
    targetPurchasePrice: formData.get("targetPurchasePrice") || undefined,
    currency: formData.get("currency"),
    requiredCargoReadyDate: formData.get("requiredCargoReadyDate") || undefined,
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const user = await requireCurrentUser();
  const { requiredCargoReadyDate, specificationId, ...rest } = parsed.data;
  let sourcingRequestId: string;
  try {
    await requirePermission(user.roleId, "SourcingRequest", "Create");
    const scopedPrisma = await getScopedPrisma();
    const deal = await scopedPrisma.deal.findUniqueOrThrow({ where: { id: dealId } });

    // specificationId اختياري جاي من الفورم — لازم يتأكد إنه فعلًا بتاع نفس المنظمة قبل الإنشاء،
    // نفس فئة الفحص اللي اتعمل لـsupplierId/facilityId في createPurchaseOrder (مراجعة وحدة 7،
    // 6 سبتمبر) — كان فاتها هنا وفي createPurchaseOrder نفسها، اتكشف في إعادة مراجعة وحدة 4
    // (7 سبتمبر). مفيش خطر كسر صفحة حاليًا (specificationId مش بيتعرض بعلاقة .specification في
    // أي صفحة)، لكن بلا الفحص بيسمح بربط طلب التوريد بمواصفة منتج منظمة تانية بصمت.
    if (specificationId) {
      const specification = await scopedPrisma.productSpecification.findFirst({ where: { id: specificationId } });
      if (!specification) return { formError: "المواصفة غير موجودة." };
    }

    sourcingRequestId = await withScopedTransaction(async (tx) => {
      const sourcingRequest = await tx.sourcingRequest.create({
        data: {
          orgId: user.orgId,
          dealId,
          productId: deal.productId,
          marketId: deal.marketId,
          specificationId: specificationId || undefined,
          requiredCargoReadyDate: requiredCargoReadyDate ? new Date(requiredCargoReadyDate) : undefined,
          ...rest,
        },
      });
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "sourcingRequest.created",
        entityType: "SourcingRequest",
        entityId: sourcingRequest.id,
        afterValue: { dealId, ...rest },
      });
      return sourcingRequest.id;
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "createSourcingRequest", error: e });
    return { formError: "حصل خطأ أثناء فتح طلب التوريد — حاول تاني." };
  }

  revalidatePath(`/deals/${dealId}`);
  redirect(`/sourcing/${sourcingRequestId}`);
}

const SUPPLIER_RFQ_STATUSES = ["Draft", "Sent", "Responded", "Expired", "Cancelled"] as const;

const SupplierRFQSchema = z.object({
  supplierId: z.string().uuid("اختر مورّد"),
  rfqNumber: z.string().trim().optional().or(z.literal("")),
  responseDeadline: z.string().trim().optional().or(z.literal("")),
  status: z.enum(SUPPLIER_RFQ_STATUSES),
});

export type SupplierRFQFormState = { errors?: Record<string, string[]>; formError?: string };

export async function createSupplierRFQ(sourcingRequestId: string, _prevState: SupplierRFQFormState, formData: FormData): Promise<SupplierRFQFormState> {
  const parsed = SupplierRFQSchema.safeParse({
    supplierId: formData.get("supplierId"),
    rfqNumber: formData.get("rfqNumber") || undefined,
    responseDeadline: formData.get("responseDeadline") || undefined,
    status: formData.get("status"),
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const user = await requireCurrentUser();
  const { rfqNumber, responseDeadline, ...rest } = parsed.data;
  try {
    await requirePermission(user.roleId, "SupplierRFQ", "Create");
    // لازم نتأكد إن supplierId فعلًا بتاع نفس المنظمة قبل الإنشاء — `r.supplier.legalName` بيتعرض
    // بلا `?.` في `/sourcing/[id]`، فأي supplierId عابر للمنظمة كان هيكسر الصفحة بالكامل
    // (اتكشف في مراجعة وحدة 7، 6 سبتمبر).
    const scopedPrisma = await getScopedPrisma();
    const supplier = await scopedPrisma.supplier.findFirst({ where: { id: rest.supplierId, deletedAt: null } });
    if (!supplier) return { formError: "المورّد غير موجود." };
    await withScopedTransaction(async (tx) => {
      const rfq = await tx.supplierRFQ.create({
        data: {
          orgId: user.orgId,
          sourcingRequestId,
          rfqNumber: rfqNumber || undefined,
          responseDeadline: responseDeadline ? new Date(responseDeadline) : undefined,
          sentAt: rest.status === "Sent" ? new Date() : undefined,
          ...rest,
        },
      });
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "supplierRFQ.created",
        entityType: "SupplierRFQ",
        entityId: rfq.id,
        afterValue: { sourcingRequestId, ...rest },
      });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "createSupplierRFQ", error: e });
    return { formError: "حصل خطأ أثناء إضافة طلب عرض الأسعار — حاول تاني." };
  }

  revalidatePath(`/sourcing/${sourcingRequestId}`);
  return {};
}

const SupplierQuoteSchema = z.object({
  supplierId: z.string().uuid("اختر مورّد"),
  unitPrice: z.coerce.number().positive("سعر الوحدة مطلوب"),
  priceUnit: z.string().trim().optional().or(z.literal("")),
  currency: z.string().trim().min(1, "العملة مطلوبة"),
  packagingIncluded: z.coerce.boolean().optional(),
  transportIncluded: z.coerce.boolean().optional(),
  paymentTerms: z.string().trim().optional().or(z.literal("")),
  leadTimeDays: z.coerce.number().int().min(0).optional(),
  availableQuantity: z.coerce.number().min(0).optional(),
  minimumOrder: z.coerce.number().min(0).optional(),
  expectedYield: z.coerce.number().min(0).max(1).optional(),
  totalEffectiveCost: z.coerce.number().min(0).optional(),
  validUntil: z.string().trim().optional().or(z.literal("")),
});

export type SupplierQuoteFormState = { errors?: Record<string, string[]>; formError?: string };

export async function createSupplierQuote(
  sourcingRequestId: string,
  _prevState: SupplierQuoteFormState,
  formData: FormData
): Promise<SupplierQuoteFormState> {
  const parsed = SupplierQuoteSchema.safeParse({
    supplierId: formData.get("supplierId"),
    unitPrice: formData.get("unitPrice"),
    priceUnit: formData.get("priceUnit") || undefined,
    currency: formData.get("currency"),
    packagingIncluded: formData.get("packagingIncluded") === "on",
    transportIncluded: formData.get("transportIncluded") === "on",
    paymentTerms: formData.get("paymentTerms") || undefined,
    leadTimeDays: formData.get("leadTimeDays") || undefined,
    availableQuantity: formData.get("availableQuantity") || undefined,
    minimumOrder: formData.get("minimumOrder") || undefined,
    expectedYield: formData.get("expectedYield") || undefined,
    totalEffectiveCost: formData.get("totalEffectiveCost") || undefined,
    validUntil: formData.get("validUntil") || undefined,
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const user = await requireCurrentUser();
  const { priceUnit, paymentTerms, validUntil, ...rest } = parsed.data;
  try {
    await requirePermission(user.roleId, "SupplierQuote", "Create");
    const scopedPrisma = await getScopedPrisma();
    const supplier = await scopedPrisma.supplier.findFirst({ where: { id: rest.supplierId, deletedAt: null } });
    if (!supplier) return { formError: "المورّد غير موجود." };
    await withScopedTransaction(async (tx) => {
      const quote = await tx.supplierQuote.create({
        data: {
          orgId: user.orgId,
          sourcingRequestId,
          priceUnit: priceUnit || undefined,
          paymentTerms: paymentTerms || undefined,
          validUntil: validUntil ? new Date(validUntil) : undefined,
          ...rest,
        },
      });
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "supplierQuote.created",
        entityType: "SupplierQuote",
        entityId: quote.id,
        afterValue: { sourcingRequestId, ...rest },
      });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "createSupplierQuote", error: e });
    return { formError: "حصل خطأ أثناء إضافة عرض المورّد — حاول تاني." };
  }

  revalidatePath(`/sourcing/${sourcingRequestId}`);
  return {};
}

const PurchaseOrderSchema = z.object({
  supplierId: z.string().uuid("اختر مورّد"),
  facilityId: z.string().uuid().optional().or(z.literal("")),
  specificationId: z.string().uuid().optional().or(z.literal("")),
  quantity: z.coerce.number().positive("الكمية مطلوبة"),
  unitPrice: z.coerce.number().positive("سعر الوحدة مطلوب"),
  currency: z.string().trim().min(1, "العملة مطلوبة"),
  paymentTerms: z.string().trim().optional().or(z.literal("")),
  penalties: z.string().trim().optional().or(z.literal("")),
});

export type PurchaseOrderFormState = { errors?: Record<string, string[]>; formError?: string };

/** لو unitPrice > SourcingRequest.maximumPurchasePrice، الـTrigger (enforce_purchase_order_max_price)
 * هيمنع إنشاء الـPurchaseOrder مباشرة أيًا كان. المسار الوحيد: طلب موافقة استثنائية (نفس نمط
 * createQuote في src/app/deals/actions.ts بالحرف — subjectId محجوز مسبقًا). */
export async function createPurchaseOrder(
  sourcingRequestId: string,
  _prevState: PurchaseOrderFormState,
  formData: FormData
): Promise<PurchaseOrderFormState> {
  const parsed = PurchaseOrderSchema.safeParse({
    supplierId: formData.get("supplierId"),
    facilityId: formData.get("facilityId") || undefined,
    specificationId: formData.get("specificationId") || undefined,
    quantity: formData.get("quantity"),
    unitPrice: formData.get("unitPrice"),
    currency: formData.get("currency"),
    paymentTerms: formData.get("paymentTerms") || undefined,
    penalties: formData.get("penalties") || undefined,
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const user = await requireCurrentUser();
  const { facilityId, specificationId, paymentTerms, penalties, ...rest } = parsed.data;

  const scopedPrisma = await getScopedPrisma();
  const sourcingRequest = await scopedPrisma.sourcingRequest.findUniqueOrThrow({ where: { id: sourcingRequestId } });

  // supplierId إلزامي وبيتعرض بلا `?.` في `/purchase-orders/[id]`/`/sourcing/[id]` (وبيتوارث
  // لـBatch.supplierId كمان)، وfacilityId بيتعرض بلا `?.` في `/batches/[id]` — لازم يتحقق
  // الاتنين قبل الإنشاء (اتكشف في مراجعة وحدة 7، 6 سبتمبر). ⚠️ مش Promise.all — راجع P2028.
  const supplier = await scopedPrisma.supplier.findFirst({ where: { id: rest.supplierId, deletedAt: null } });
  if (!supplier) return { formError: "المورّد غير موجود." };
  if (facilityId) {
    const facility = await scopedPrisma.facility.findFirst({ where: { id: facilityId } });
    if (!facility) return { formError: "المنشأة غير موجودة." };
  }
  // specificationId كان فات وقت فحص supplierId/facilityId (مراجعة وحدة 7، 6 سبتمبر) — اتكشف
  // في إعادة مراجعة وحدة 4 (7 سبتمبر). راجع نفس الملحوظة في createSourcingRequest فوق.
  if (specificationId) {
    const specification = await scopedPrisma.productSpecification.findFirst({ where: { id: specificationId } });
    if (!specification) return { formError: "المواصفة غير موجودة." };
  }

  const abovePriceCeiling = new Prisma.Decimal(rest.unitPrice).greaterThan(sourcingRequest.maximumPurchasePrice);

  if (abovePriceCeiling) {
    const existingPending = await scopedPrisma.approval.findFirst({
      where: {
        orgId: user.orgId,
        subjectType: "PurchaseOrder.unitPrice_override",
        decision: "Pending",
        payload: { path: ["sourcingRequestId"], equals: sourcingRequestId },
      },
    });
    if (existingPending) {
      return { formError: "في طلب موافقة استثنائية معلّق بالفعل لطلب التوريد ده — استنى قرار المدير قبل ما تطلب تاني." };
    }

    try {
      await requirePermission(user.roleId, "PurchaseOrder", "Create");
      await withScopedTransaction(async (tx) => {
        const [{ id: reservedPoId }] = await tx.$queryRaw<{ id: string }[]>`SELECT uuidv7() AS id`;
        const approval = await tx.approval.create({
          data: {
            orgId: user.orgId,
            subjectType: "PurchaseOrder.unitPrice_override",
            subjectId: reservedPoId,
            requestedBy: user.id,
            payload: {
              sourcingRequestId,
              dealId: sourcingRequest.dealId,
              supplierId: rest.supplierId,
              facilityId: facilityId || null,
              specificationId: specificationId || null,
              quantity: rest.quantity,
              unitPrice: rest.unitPrice,
              currency: rest.currency,
              paymentTerms: paymentTerms || null,
              penalties: penalties || null,
              maximumPurchasePrice: sourcingRequest.maximumPurchasePrice.toString(),
            },
          },
        });
        await logAudit(tx, {
          orgId: user.orgId,
          userId: user.id,
          action: "purchaseOrder.approvalRequested",
          entityType: "Approval",
          entityId: approval.id,
          afterValue: { sourcingRequestId, unitPrice: rest.unitPrice, maximumPurchasePrice: sourcingRequest.maximumPurchasePrice.toString() },
        });
      });
    } catch (e) {
      if (isNextControlFlowError(e)) throw e;
      await logError({ orgId: user.orgId, userId: user.id, action: "requestPurchaseOrderApproval", error: e });
      return { formError: "حصل خطأ أثناء إرسال طلب الموافقة — حاول تاني." };
    }

    revalidatePath(`/sourcing/${sourcingRequestId}`);
    redirect(`/sourcing/${sourcingRequestId}`);
  }

  try {
    await requirePermission(user.roleId, "PurchaseOrder", "Create");
    await withScopedTransaction(async (tx) => {
      const year = new Date().getFullYear();
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`po-number-${user.orgId}-${year}`}))`;
      const countThisYear = await tx.purchaseOrder.count({ where: { orgId: user.orgId, poNumber: { startsWith: `PO-${year}-` } } });
      const poNumber = `PO-${year}-${String(countThisYear + 1).padStart(4, "0")}`;

      const po = await tx.purchaseOrder.create({
        data: {
          orgId: user.orgId,
          sourcingRequestId,
          facilityId: facilityId || undefined,
          specificationId: specificationId || undefined,
          poNumber,
          paymentTerms: paymentTerms || undefined,
          penalties: penalties || undefined,
          ...rest,
        },
      });
      await tx.sourcingRequest.update({ where: { id: sourcingRequestId }, data: { status: "POIssued" } });
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "purchaseOrder.created",
        entityType: "PurchaseOrder",
        entityId: po.id,
        afterValue: { sourcingRequestId, poNumber, ...rest },
      });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "createPurchaseOrder", error: e });
    return { formError: "حصل خطأ أثناء إنشاء أمر الشراء — حاول تاني." };
  }

  revalidatePath(`/sourcing/${sourcingRequestId}`);
  return {};
}
