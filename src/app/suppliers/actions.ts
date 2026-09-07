"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getScopedPrisma, withScopedTransaction } from "@/lib/scoped-prisma";
import { requireCurrentUser } from "@/lib/session";
import { requirePermission, getPermissionScope } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { logError, isNextControlFlowError, businessRuleMessage } from "@/lib/errorLog";
import { requireAal2 } from "@/lib/mfa";
import { encryptSecret, updateSecret } from "@/lib/vault";
import { requestEntityCreation } from "@/lib/masterDataChangeRequest";
import { SupplierSchema } from "@/lib/supplierSchema";

export type SupplierFormState = { errors?: Record<string, string[]>; formError?: string };

export async function createSupplier(_prevState: SupplierFormState, formData: FormData): Promise<SupplierFormState> {
  const parsed = SupplierSchema.safeParse({
    legalName: formData.get("legalName"),
    tradeName: formData.get("tradeName") || undefined,
    country: formData.get("country") || undefined,
    governorate: formData.get("governorate") || undefined,
    city: formData.get("city") || undefined,
    taxId: formData.get("taxId") || undefined,
    commercialRegNo: formData.get("commercialRegNo") || undefined,
    supplierType: formData.getAll("supplierType"),
    status: formData.get("status"),
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const user = await requireCurrentUser();

  if (!(await getPermissionScope(user.roleId, "Supplier", "Create"))) {
    if (!(await getPermissionScope(user.roleId, "MasterDataChangeRequest", "Create"))) {
      return { formError: "معندكش صلاحية إضافة مورّد، ولا صلاحية طلب إضافة." };
    }
    try {
      await withScopedTransaction((tx) =>
        requestEntityCreation(tx, { orgId: user.orgId, userId: user.id, entityType: "Supplier", proposedChanges: parsed.data })
      );
    } catch (e) {
      if (isNextControlFlowError(e)) throw e;
      await logError({ orgId: user.orgId, userId: user.id, action: "createSupplier.request", error: e });
      return { formError: "حصل خطأ أثناء تسجيل الطلب — حاول تاني." };
    }
    revalidatePath("/governance/change-requests");
    redirect("/governance/change-requests");
  }

  const { tradeName, country, governorate, city, taxId, commercialRegNo, ...rest } = parsed.data;
  let supplierId: string;
  try {
    await requirePermission(user.roleId, "Supplier", "Create");
    supplierId = await withScopedTransaction(async (tx) => {
      const supplier = await tx.supplier.create({
        data: {
          orgId: user.orgId,
          tradeName: tradeName || undefined,
          country: country || undefined,
          governorate: governorate || undefined,
          city: city || undefined,
          taxId: taxId || undefined,
          commercialRegNo: commercialRegNo || undefined,
          supplierType: rest.supplierType ?? [],
          createdBy: user.id,
          ...rest,
        },
      });
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "supplier.created",
        entityType: "Supplier",
        entityId: supplier.id,
        afterValue: { ...rest },
      });
      return supplier.id;
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "createSupplier", error: e });
    return { formError: "حصل خطأ أثناء إضافة المورّد — حاول تاني." };
  }

  revalidatePath("/suppliers");
  redirect(`/suppliers/${supplierId}`);
}

const FACILITY_TYPES = [
  "Farm", "Field", "CollectionCenter", "PackingHouse", "Factory", "FreezingFacility", "DryingFacility", "ProcessingFacility", "Warehouse", "ColdStore", "Laboratory",
] as const;
const FACILITY_STATUSES = ["Active", "UnderReview", "Suspended", "Closed"] as const;

const FacilitySchema = z.object({
  facilityType: z.enum(FACILITY_TYPES),
  name: z.string().trim().min(1, "اسم المنشأة مطلوب"),
  address: z.string().trim().optional().or(z.literal("")),
  capacityDaily: z.coerce.number().min(0).optional(),
  productionLines: z.coerce.number().int().min(0).optional(),
  shifts: z.coerce.number().int().min(0).optional(),
  hasTraceabilitySystem: z.coerce.boolean().optional(),
  status: z.enum(FACILITY_STATUSES),
});

export type FacilityFormState = { errors?: Record<string, string[]>; formError?: string };

export async function createFacility(supplierId: string, _prevState: FacilityFormState, formData: FormData): Promise<FacilityFormState> {
  const parsed = FacilitySchema.safeParse({
    facilityType: formData.get("facilityType"),
    name: formData.get("name"),
    address: formData.get("address") || undefined,
    capacityDaily: formData.get("capacityDaily") || undefined,
    productionLines: formData.get("productionLines") || undefined,
    shifts: formData.get("shifts") || undefined,
    hasTraceabilitySystem: formData.get("hasTraceabilitySystem") === "on",
    status: formData.get("status"),
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const user = await requireCurrentUser();
  const { address, ...rest } = parsed.data;
  try {
    await requirePermission(user.roleId, "Facility", "Create");
    await withScopedTransaction(async (tx) => {
      const facility = await tx.facility.create({
        data: { orgId: user.orgId, supplierId, address: address || undefined, ...rest },
      });
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "facility.created",
        entityType: "Facility",
        entityId: facility.id,
        afterValue: { supplierId, ...rest },
      });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "createFacility", error: e });
    return { formError: "حصل خطأ أثناء إضافة المنشأة — حاول تاني." };
  }

  revalidatePath(`/suppliers/${supplierId}`);
  return {};
}

const NCR_TYPES = [
  "RawMaterialDefect", "SpecificationFailure", "PackagingFailure", "LabelError", "WeightDeviation", "MoistureFailure", "PurityFailure", "MicrobiologicalFailure", "PesticideFailure", "TemperatureFailure", "ForeignMatter", "TraceabilityFailure", "DocumentationFailure", "SupplierDelay", "QuantityShortage", "MixedBatch",
] as const;
const NCR_SEVERITIES = ["Observation", "Minor", "Major", "Critical"] as const;

const NCRSchema = z.object({
  facilityId: z.string().uuid("اختر منشأة"),
  capaId: z.string().uuid().optional().or(z.literal("")),
  ncrType: z.enum(NCR_TYPES),
  severity: z.enum(NCR_SEVERITIES),
  quantityAffected: z.coerce.number().min(0).optional(),
  financialExposure: z.coerce.number().min(0).optional(),
  currency: z.string().trim().optional().or(z.literal("")),
  immediateContainment: z.string().trim().optional().or(z.literal("")),
});

export type NCRFormState = { errors?: Record<string, string[]>; formError?: string };

/** batchId/lotId بلا واجهة إدخال هذه الشريحة. */
export async function createNCR(supplierId: string, _prevState: NCRFormState, formData: FormData): Promise<NCRFormState> {
  const parsed = NCRSchema.safeParse({
    facilityId: formData.get("facilityId"),
    capaId: formData.get("capaId") || undefined,
    ncrType: formData.get("ncrType"),
    severity: formData.get("severity"),
    quantityAffected: formData.get("quantityAffected") || undefined,
    financialExposure: formData.get("financialExposure") || undefined,
    currency: formData.get("currency") || undefined,
    immediateContainment: formData.get("immediateContainment") || undefined,
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const user = await requireCurrentUser();
  const { capaId, currency, immediateContainment, ...rest } = parsed.data;
  try {
    await requirePermission(user.roleId, "NCR", "Create");
    // facilityId إلزامي وبيتعرض بلا `?.` في `/suppliers/[id]` (`n.facility.name`) — لازم يتحقق
    // قبل الإنشاء (اتكشف في مراجعة وحدة 7، 6 سبتمبر).
    const scopedPrisma = await getScopedPrisma();
    const facility = await scopedPrisma.facility.findFirst({ where: { id: rest.facilityId } });
    if (!facility) return { formError: "المنشأة غير موجودة." };
    // capaId اختياري جاي من الفورم — لازم يتأكد إنه فعلًا بتاع نفس المنظمة قبل الإنشاء (اتكشف
    // في إعادة مراجعة وحدة 7، 7 سبتمبر — كان فات وقت فحص facilityId في المراجعة الأولى).
    if (capaId) {
      const capa = await scopedPrisma.cAPA.findFirst({ where: { id: capaId } });
      if (!capa) return { formError: "الـCAPA غير موجود." };
    }
    await withScopedTransaction(async (tx) => {
      const ncr = await tx.nCR.create({
        data: {
          orgId: user.orgId,
          supplierId,
          capaId: capaId || undefined,
          currency: currency || undefined,
          immediateContainment: immediateContainment || undefined,
          ...rest,
        },
      });
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "ncr.created",
        entityType: "NCR",
        entityId: ncr.id,
        afterValue: { supplierId, ...rest },
      });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "createNCR", error: e });
    return { formError: "حصل خطأ أثناء تسجيل مخالفة عدم المطابقة — حاول تاني." };
  }

  revalidatePath(`/suppliers/${supplierId}`);
  return {};
}

const SUPPLIER_AUDIT_DECISIONS = ["Approved", "ConditionalApproval", "Rejected"] as const;

const SupplierAuditSchema = z.object({
  facilityId: z.string().uuid().optional().or(z.literal("")),
  auditDate: z.string().trim().optional().or(z.literal("")),
  auditor: z.string().trim().optional().or(z.literal("")),
  totalScore: z.coerce.number().min(0).max(100).optional(),
  criticalFindings: z.coerce.number().int().min(0).optional(),
  majorFindings: z.coerce.number().int().min(0).optional(),
  minorFindings: z.coerce.number().int().min(0).optional(),
  decision: z.enum(SUPPLIER_AUDIT_DECISIONS),
  followUpDate: z.string().trim().optional().or(z.literal("")),
});

export type SupplierAuditFormState = { errors?: Record<string, string[]>; formError?: string };

export async function createSupplierAudit(supplierId: string, _prevState: SupplierAuditFormState, formData: FormData): Promise<SupplierAuditFormState> {
  const parsed = SupplierAuditSchema.safeParse({
    facilityId: formData.get("facilityId") || undefined,
    auditDate: formData.get("auditDate") || undefined,
    auditor: formData.get("auditor") || undefined,
    totalScore: formData.get("totalScore") || undefined,
    criticalFindings: formData.get("criticalFindings") || undefined,
    majorFindings: formData.get("majorFindings") || undefined,
    minorFindings: formData.get("minorFindings") || undefined,
    decision: formData.get("decision"),
    followUpDate: formData.get("followUpDate") || undefined,
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const user = await requireCurrentUser();
  const { facilityId, auditDate, auditor, followUpDate, ...rest } = parsed.data;
  try {
    await requirePermission(user.roleId, "SupplierAudit", "Create");
    // facilityId اختياري جاي من الفورم — لازم يتأكد إنه فعلًا بتاع نفس المنظمة قبل الإنشاء
    // (اتكشف في إعادة مراجعة وحدة 7، 7 سبتمبر).
    if (facilityId) {
      const scopedPrisma = await getScopedPrisma();
      const facility = await scopedPrisma.facility.findFirst({ where: { id: facilityId } });
      if (!facility) return { formError: "المنشأة غير موجودة." };
    }
    await withScopedTransaction(async (tx) => {
      const audit = await tx.supplierAudit.create({
        data: {
          orgId: user.orgId,
          supplierId,
          facilityId: facilityId || undefined,
          auditDate: auditDate ? new Date(auditDate) : undefined,
          auditor: auditor || undefined,
          followUpDate: followUpDate ? new Date(followUpDate) : undefined,
          ...rest,
        },
      });
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "supplierAudit.created",
        entityType: "SupplierAudit",
        entityId: audit.id,
        afterValue: { supplierId, ...rest },
      });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "createSupplierAudit", error: e });
    return { formError: "حصل خطأ أثناء تسجيل التدقيق — حاول تاني." };
  }

  revalidatePath(`/suppliers/${supplierId}`);
  return {};
}

const SUPPLY_CONTRACT_TYPES = ["Framework", "TollProcessing", "FarmingContract", "ExclusiveSupply", "SeasonalContract", "SpotAgreement"] as const;
const SUPPLY_CONTRACT_STATUSES = ["Draft", "UnderNegotiation", "Active", "Expired", "Terminated"] as const;

const SupplyContractSchema = z.object({
  contractType: z.enum(SUPPLY_CONTRACT_TYPES),
  documentId: z.string().uuid().optional().or(z.literal("")),
  startDate: z.string().trim().optional().or(z.literal("")),
  endDate: z.string().trim().optional().or(z.literal("")),
  priceAdjustmentMechanism: z.string().trim().optional().or(z.literal("")),
  forceMajeureClause: z.string().trim().optional().or(z.literal("")),
  penaltyTerms: z.string().trim().optional().or(z.literal("")),
  status: z.enum(SUPPLY_CONTRACT_STATUSES),
});

export type SupplyContractFormState = { errors?: Record<string, string[]>; formError?: string };

export async function createSupplyContract(supplierId: string, _prevState: SupplyContractFormState, formData: FormData): Promise<SupplyContractFormState> {
  const parsed = SupplyContractSchema.safeParse({
    contractType: formData.get("contractType"),
    documentId: formData.get("documentId") || undefined,
    startDate: formData.get("startDate") || undefined,
    endDate: formData.get("endDate") || undefined,
    priceAdjustmentMechanism: formData.get("priceAdjustmentMechanism") || undefined,
    forceMajeureClause: formData.get("forceMajeureClause") || undefined,
    penaltyTerms: formData.get("penaltyTerms") || undefined,
    status: formData.get("status"),
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const user = await requireCurrentUser();
  const { documentId, startDate, endDate, priceAdjustmentMechanism, forceMajeureClause, penaltyTerms, ...rest } = parsed.data;
  try {
    await requirePermission(user.roleId, "SupplyContract", "Create");
    // documentId اختياري جاي من الفورم — لازم يتأكد إنه فعلًا بتاع نفس المنظمة قبل الإنشاء
    // (اتكشف في إعادة مراجعة وحدة 7، 7 سبتمبر).
    if (documentId) {
      const scopedPrisma = await getScopedPrisma();
      const document = await scopedPrisma.document.findFirst({ where: { id: documentId } });
      if (!document) return { formError: "المستند غير موجود." };
    }
    await withScopedTransaction(async (tx) => {
      const contract = await tx.supplyContract.create({
        data: {
          orgId: user.orgId,
          supplierId,
          documentId: documentId || undefined,
          startDate: startDate ? new Date(startDate) : undefined,
          endDate: endDate ? new Date(endDate) : undefined,
          priceAdjustmentMechanism: priceAdjustmentMechanism || undefined,
          forceMajeureClause: forceMajeureClause || undefined,
          penaltyTerms: penaltyTerms || undefined,
          ...rest,
        },
      });
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "supplyContract.created",
        entityType: "SupplyContract",
        entityId: contract.id,
        afterValue: { supplierId, ...rest },
      });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "createSupplyContract", error: e });
    return { formError: "حصل خطأ أثناء إضافة عقد التوريد — حاول تاني." };
  }

  revalidatePath(`/suppliers/${supplierId}`);
  return {};
}

const PACKAGING_MATERIAL_TYPES = ["Carton", "Bag", "Label", "Jar", "Bottle", "Pallet", "StretchFilm", "Strap", "InnerLiner", "Divider"] as const;
const PACKAGING_MATERIAL_STATUSES = ["Requested", "Ordered", "PartiallyReceived", "Received", "Accepted", "Rejected"] as const;

const PackagingMaterialSchema = z.object({
  materialType: z.enum(PACKAGING_MATERIAL_TYPES),
  specification: z.string().trim().optional().or(z.literal("")),
  dimensions: z.string().trim().optional().or(z.literal("")),
  artworkVersion: z.string().trim().optional().or(z.literal("")),
  artworkApproved: z.coerce.boolean().optional(),
  minimumOrder: z.coerce.number().min(0).optional(),
  leadTimeDays: z.coerce.number().int().min(0).optional(),
  quantityOrdered: z.coerce.number().min(0).optional(),
  quantityReceived: z.coerce.number().min(0).optional(),
  quantityAccepted: z.coerce.number().min(0).optional(),
  unitCost: z.coerce.number().min(0).optional(),
  currency: z.string().trim().optional().or(z.literal("")),
  status: z.enum(PACKAGING_MATERIAL_STATUSES),
});

export type PackagingMaterialFormState = { errors?: Record<string, string[]>; formError?: string };

export async function createPackagingMaterial(supplierId: string, _prevState: PackagingMaterialFormState, formData: FormData): Promise<PackagingMaterialFormState> {
  const parsed = PackagingMaterialSchema.safeParse({
    materialType: formData.get("materialType"),
    specification: formData.get("specification") || undefined,
    dimensions: formData.get("dimensions") || undefined,
    artworkVersion: formData.get("artworkVersion") || undefined,
    artworkApproved: formData.get("artworkApproved") === "on",
    minimumOrder: formData.get("minimumOrder") || undefined,
    leadTimeDays: formData.get("leadTimeDays") || undefined,
    quantityOrdered: formData.get("quantityOrdered") || undefined,
    quantityReceived: formData.get("quantityReceived") || undefined,
    quantityAccepted: formData.get("quantityAccepted") || undefined,
    unitCost: formData.get("unitCost") || undefined,
    currency: formData.get("currency") || undefined,
    status: formData.get("status"),
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const user = await requireCurrentUser();
  const { specification, dimensions, artworkVersion, currency, ...rest } = parsed.data;
  try {
    await requirePermission(user.roleId, "PackagingMaterial", "Create");
    await withScopedTransaction(async (tx) => {
      const material = await tx.packagingMaterial.create({
        data: {
          orgId: user.orgId,
          supplierId,
          specification: specification || undefined,
          dimensions: dimensions || undefined,
          artworkVersion: artworkVersion || undefined,
          currency: currency || undefined,
          ...rest,
        },
      });
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "packagingMaterial.created",
        entityType: "PackagingMaterial",
        entityId: material.id,
        afterValue: { supplierId, ...rest },
      });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "createPackagingMaterial", error: e });
    return { formError: "حصل خطأ أثناء إضافة مادة التعبئة — حاول تاني." };
  }

  revalidatePath(`/suppliers/${supplierId}`);
  return {};
}

const SUPPLIER_SAMPLE_PURPOSES = ["Qualification", "PrePurchase", "Production", "Retention", "Customer", "Laboratory", "Shipment"] as const;
const SUPPLIER_SAMPLE_RESULTS = ["Pending", "Approved", "Conditional", "Rejected"] as const;
const SUPPLIER_SAMPLE_STATUSES = ["Requested", "Sent", "Received", "Evaluated", "Closed"] as const;

const SupplierSampleSchema = z.object({
  productId: z.string().uuid("اختر منتج"),
  batchId: z.string().uuid().optional().or(z.literal("")),
  purpose: z.enum(SUPPLIER_SAMPLE_PURPOSES),
  quantity: z.coerce.number().min(0).optional(),
  cost: z.coerce.number().min(0).optional(),
  currency: z.string().trim().optional().or(z.literal("")),
  result: z.enum(SUPPLIER_SAMPLE_RESULTS),
  status: z.enum(SUPPLIER_SAMPLE_STATUSES),
});

export type SupplierSampleFormState = { errors?: Record<string, string[]>; formError?: string };

export async function createSupplierSample(supplierId: string, _prevState: SupplierSampleFormState, formData: FormData): Promise<SupplierSampleFormState> {
  const parsed = SupplierSampleSchema.safeParse({
    productId: formData.get("productId"),
    batchId: formData.get("batchId") || undefined,
    purpose: formData.get("purpose"),
    quantity: formData.get("quantity") || undefined,
    cost: formData.get("cost") || undefined,
    currency: formData.get("currency") || undefined,
    result: formData.get("result"),
    status: formData.get("status"),
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const user = await requireCurrentUser();
  const { batchId, currency, ...rest } = parsed.data;
  try {
    await requirePermission(user.roleId, "SupplierSample", "Create");
    // productId إلزامي وبيتعرض بلا `?.` في `/suppliers/[id]` (`s.product.nameAr`) — لازم يتحقق
    // قبل الإنشاء (اتكشف في مراجعة وحدة 7، 6 سبتمبر).
    const scopedPrisma = await getScopedPrisma();
    const product = await scopedPrisma.product.findFirst({ where: { id: rest.productId, deletedAt: null } });
    if (!product) return { formError: "المنتج غير موجود." };
    // batchId اختياري جاي من الفورم — لازم يتأكد إنه فعلًا بتاع نفس المنظمة قبل الإنشاء (اتكشف
    // في إعادة مراجعة وحدة 7، 7 سبتمبر).
    if (batchId) {
      const batch = await scopedPrisma.batch.findFirst({ where: { id: batchId } });
      if (!batch) return { formError: "الدفعة غير موجودة." };
    }
    await withScopedTransaction(async (tx) => {
      const sample = await tx.supplierSample.create({
        data: {
          orgId: user.orgId,
          supplierId,
          batchId: batchId || undefined,
          currency: currency || undefined,
          ...rest,
        },
      });
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "supplierSample.created",
        entityType: "SupplierSample",
        entityId: sample.id,
        afterValue: { supplierId, ...rest },
      });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "createSupplierSample", error: e });
    return { formError: "حصل خطأ أثناء تسجيل العينة — حاول تاني." };
  }

  revalidatePath(`/suppliers/${supplierId}`);
  return {};
}

const SUPPLIER_PERFORMANCE_CLASSIFICATIONS = ["Strategic", "Preferred", "Approved", "Conditional", "ImprovementRequired", "Suspended", "ExitRecommended"] as const;

const SupplierPerformanceSchema = z.object({
  periodStart: z.string().trim().min(1, "بداية الفترة مطلوبة"),
  periodEnd: z.string().trim().min(1, "نهاية الفترة مطلوبة"),
  qualityPassRate: z.coerce.number().min(0).max(100).optional(),
  rejectionRate: z.coerce.number().min(0).max(100).optional(),
  onTimeDeliveryRate: z.coerce.number().min(0).max(100).optional(),
  yieldAccuracy: z.coerce.number().min(0).max(100).optional(),
  priceAccuracy: z.coerce.number().min(0).max(100).optional(),
  overallScore: z.coerce.number().min(0).max(100).optional(),
  classification: z.enum(SUPPLIER_PERFORMANCE_CLASSIFICATIONS).optional().or(z.literal("")),
});

export type SupplierPerformanceFormState = { errors?: Record<string, string[]>; formError?: string };

export async function createSupplierPerformance(supplierId: string, _prevState: SupplierPerformanceFormState, formData: FormData): Promise<SupplierPerformanceFormState> {
  const parsed = SupplierPerformanceSchema.safeParse({
    periodStart: formData.get("periodStart"),
    periodEnd: formData.get("periodEnd"),
    qualityPassRate: formData.get("qualityPassRate") || undefined,
    rejectionRate: formData.get("rejectionRate") || undefined,
    onTimeDeliveryRate: formData.get("onTimeDeliveryRate") || undefined,
    yieldAccuracy: formData.get("yieldAccuracy") || undefined,
    priceAccuracy: formData.get("priceAccuracy") || undefined,
    overallScore: formData.get("overallScore") || undefined,
    classification: formData.get("classification") || undefined,
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const user = await requireCurrentUser();
  const { periodStart, periodEnd, classification, ...rest } = parsed.data;
  try {
    await requirePermission(user.roleId, "SupplierPerformance", "Create");
    await withScopedTransaction(async (tx) => {
      const performance = await tx.supplierPerformance.create({
        data: {
          orgId: user.orgId,
          supplierId,
          periodStart: new Date(periodStart),
          periodEnd: new Date(periodEnd),
          classification: classification || undefined,
          ...rest,
        },
      });
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "supplierPerformance.created",
        entityType: "SupplierPerformance",
        entityId: performance.id,
        afterValue: { supplierId, ...rest },
      });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "createSupplierPerformance", error: e });
    return { formError: "حصل خطأ أثناء تسجيل تقييم الأداء — حاول تاني." };
  }

  revalidatePath(`/suppliers/${supplierId}`);
  return {};
}

const SupplierBankInfoSchema = z.object({
  bankAccountName: z.string().trim().optional().or(z.literal("")),
  bankIBAN: z.string().trim().optional().or(z.literal("")),
});

export type SupplierBankInfoFormState = { errors?: Record<string, string[]>; formError?: string; mfaRequired?: boolean; success?: boolean };

/** أول واجهة إدخال حقيقية لحقل 🔒 مشفّر عبر Vault (4 سبتمبر) — قيمة الحقل بتتشفّر جوه
 * `encryptSecret()`/`updateSecret()` قبل ما توصل لأي مكان تاني، والعمود في الجدول بيسجّل
 * secretId بس (راجع src/lib/vault.ts). **حقل فاضي في الفورم = سيبه زي ما هو**، مش مسح —
 * عشان تعديل جزئي (IBAN بس مثلًا) مايمسحش اسم الحساب المسجَّل قبل كده بالغلط. MFA (aal2)
 * إلزامي هنا — قيد غير قابل للتفاوض من CLAUDE.md لأي فتح/تعديل بيانات بنكية. */
export async function updateSupplierBankInfoAction(
  supplierId: string,
  _prevState: SupplierBankInfoFormState,
  formData: FormData
): Promise<SupplierBankInfoFormState> {
  const parsed = SupplierBankInfoSchema.safeParse({
    bankAccountName: formData.get("bankAccountName") || undefined,
    bankIBAN: formData.get("bankIBAN") || undefined,
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const { bankAccountName, bankIBAN } = parsed.data;
  if (!bankAccountName && !bankIBAN) return { formError: "دخّل قيمة واحدة على الأقل." };

  const user = await requireCurrentUser();
  try {
    await requirePermission(user.roleId, "Supplier", "Edit");
  } catch {
    return { formError: "معندكش صلاحية تعديل بيانات المورّد." };
  }
  try {
    await requireAal2();
  } catch {
    return { formError: "تعديل بيانات بنكية محتاج تحقق بخطوتين (MFA) الأول.", mfaRequired: true };
  }

  try {
    const supplier = await withScopedTransaction((tx) => tx.supplier.findUniqueOrThrow({ where: { id: supplierId } }));

    // التشفير برّه الـtransaction الرئيسية عمدًا — vault.* بيفتح transaction منفصلة لكل نداء
    // (راجع src/lib/vault.ts)، فمفيش فايدة من لفّها في نفس الـtransaction بتاعة تحديث الصف.
    const updates: { bankAccountNameSecretId?: string; bankIBANSecretId?: string } = {};
    if (bankAccountName) {
      updates.bankAccountNameSecretId = supplier.bankAccountNameSecretId
        ? await updateSecret(supplier.bankAccountNameSecretId, bankAccountName).then(() => supplier.bankAccountNameSecretId!)
        : await encryptSecret(bankAccountName, `Supplier ${supplierId} bankAccountName`);
    }
    if (bankIBAN) {
      updates.bankIBANSecretId = supplier.bankIBANSecretId
        ? await updateSecret(supplier.bankIBANSecretId, bankIBAN).then(() => supplier.bankIBANSecretId!)
        : await encryptSecret(bankIBAN, `Supplier ${supplierId} bankIBAN`);
    }

    await withScopedTransaction(async (tx) => {
      await tx.supplier.update({ where: { id: supplierId }, data: updates });
      // ممنوع تسجيل القيمة الفعلية في الـAuditLog — بس تسجيل إن التعديل حصل ومين عمله.
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "supplier.bankInfoUpdated",
        entityType: "Supplier",
        entityId: supplierId,
        afterValue: { fieldsUpdated: Object.keys(updates) },
      });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "updateSupplierBankInfoAction", error: e });
    return { formError: businessRuleMessage(e, "حصل خطأ أثناء حفظ البيانات البنكية — حاول تاني.") };
  }

  revalidatePath(`/suppliers/${supplierId}`);
  return { success: true };
}

const FARM_RISK_LEVELS = ["Low", "Medium", "High"] as const;

const FarmSchema = z.object({
  farmerName: z.string().trim().optional().or(z.literal("")),
  location: z.string().trim().optional().or(z.literal("")),
  areaFeddan: z.coerce.number().min(0).optional(),
  crop: z.string().trim().optional().or(z.literal("")),
  variety: z.string().trim().optional().or(z.literal("")),
  plantingDate: z.string().trim().optional().or(z.literal("")),
  expectedHarvestStart: z.string().trim().optional().or(z.literal("")),
  expectedHarvestEnd: z.string().trim().optional().or(z.literal("")),
  expectedQuantity: z.coerce.number().min(0).optional(),
  riskLevel: z.enum(FARM_RISK_LEVELS),
});

export type FarmFormState = { errors?: Record<string, string[]>; formError?: string };

export async function createFarm(supplierId: string, _prevState: FarmFormState, formData: FormData): Promise<FarmFormState> {
  const parsed = FarmSchema.safeParse({
    farmerName: formData.get("farmerName") || undefined,
    location: formData.get("location") || undefined,
    areaFeddan: formData.get("areaFeddan") || undefined,
    crop: formData.get("crop") || undefined,
    variety: formData.get("variety") || undefined,
    plantingDate: formData.get("plantingDate") || undefined,
    expectedHarvestStart: formData.get("expectedHarvestStart") || undefined,
    expectedHarvestEnd: formData.get("expectedHarvestEnd") || undefined,
    expectedQuantity: formData.get("expectedQuantity") || undefined,
    riskLevel: formData.get("riskLevel"),
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const user = await requireCurrentUser();
  const { farmerName, location, crop, variety, plantingDate, expectedHarvestStart, expectedHarvestEnd, ...rest } = parsed.data;
  try {
    await requirePermission(user.roleId, "Farm", "Create");
    await withScopedTransaction(async (tx) => {
      const farm = await tx.farm.create({
        data: {
          orgId: user.orgId,
          supplierId,
          farmerName: farmerName || undefined,
          location: location || undefined,
          crop: crop || undefined,
          variety: variety || undefined,
          plantingDate: plantingDate ? new Date(plantingDate) : undefined,
          expectedHarvestStart: expectedHarvestStart ? new Date(expectedHarvestStart) : undefined,
          expectedHarvestEnd: expectedHarvestEnd ? new Date(expectedHarvestEnd) : undefined,
          ...rest,
        },
      });
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "farm.created",
        entityType: "Farm",
        entityId: farm.id,
        afterValue: { supplierId, ...rest },
      });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "createFarm", error: e });
    return { formError: "حصل خطأ أثناء إضافة المزرعة — حاول تاني." };
  }

  revalidatePath(`/suppliers/${supplierId}`);
  return {};
}
