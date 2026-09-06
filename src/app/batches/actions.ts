"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getScopedPrisma, withScopedTransaction } from "@/lib/scoped-prisma";
import { requireCurrentUser } from "@/lib/session";
import { requirePermission } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { logError, isNextControlFlowError } from "@/lib/errorLog";

const INSPECTION_STAGES = [
  "PreQualification", "IncomingRawMaterial", "DuringProduction", "PrePackaging", "PackagingInspection", "FinalProduct", "PreLoading", "ContainerInspection",
] as const;
const INSPECTION_RESULTS = ["Pass", "ConditionalPass", "Fail"] as const;

const InspectionSchema = z.object({
  stage: z.enum(INSPECTION_STAGES),
  samplingMethod: z.string().trim().optional().or(z.literal("")),
  sampleSize: z.coerce.number().min(0).optional(),
  result: z.enum(INSPECTION_RESULTS),
});

export type InspectionFormState = { errors?: Record<string, string[]>; formError?: string };

/** facilityId بيتشتق من الدفعة (Batch.facilityId) مباشرة — نفس نمط اشتقاق productId من الصفقة. */
export async function createInspection(batchId: string, _prevState: InspectionFormState, formData: FormData): Promise<InspectionFormState> {
  const parsed = InspectionSchema.safeParse({
    stage: formData.get("stage"),
    samplingMethod: formData.get("samplingMethod") || undefined,
    sampleSize: formData.get("sampleSize") || undefined,
    result: formData.get("result"),
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const user = await requireCurrentUser();
  const { samplingMethod, ...rest } = parsed.data;
  try {
    await requirePermission(user.roleId, "Inspection", "Create");
    const scopedPrisma = await getScopedPrisma();
    const batch = await scopedPrisma.batch.findUniqueOrThrow({ where: { id: batchId } });

    await withScopedTransaction(async (tx) => {
      const inspection = await tx.inspection.create({
        data: {
          orgId: user.orgId,
          batchId,
          facilityId: batch.facilityId,
          inspectorId: user.id,
          samplingMethod: samplingMethod || undefined,
          ...rest,
        },
      });
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "inspection.created",
        entityType: "Inspection",
        entityId: inspection.id,
        afterValue: { batchId, ...rest },
      });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "createInspection", error: e });
    return { formError: "حصل خطأ أثناء تسجيل الفحص — حاول تاني." };
  }

  revalidatePath(`/batches/${batchId}`);
  return {};
}

const QUALITY_RELEASE_STATUSES = ["Released", "PartialRelease", "ConditionalRelease", "Held", "Rejected"] as const;

const QualityReleaseSchema = z.object({
  releasedQuantity: z.coerce.number().min(0).optional(),
  rejectedQuantity: z.coerce.number().min(0).optional(),
  status: z.enum(QUALITY_RELEASE_STATUSES),
});

export type QualityReleaseFormState = { errors?: Record<string, string[]>; formError?: string };

/** Batch.qualityStatus (4 قيم: Pending/Released/Held/Rejected) بيتحدّث تلقائيًا حسب قرار
 * الإفراج — بدون كده صفحة الدفعة كانت بتفضل عارضة "قيد الانتظار" للأبد حتى بعد إفراج فعلي
 * (باگ حقيقي اتلقط في مراجعة وحدة 7). PartialRelease/ConditionalRelease بيترجموا لـReleased
 * (أقرب قيمة متاحة — الـenum معندوش تفصيل جزئي/مشروط). */
const QUALITY_RELEASE_TO_BATCH_STATUS: Record<(typeof QUALITY_RELEASE_STATUSES)[number], "Released" | "Held" | "Rejected"> = {
  Released: "Released",
  PartialRelease: "Released",
  ConditionalRelease: "Released",
  Held: "Held",
  Rejected: "Rejected",
};

export async function createQualityRelease(batchId: string, _prevState: QualityReleaseFormState, formData: FormData): Promise<QualityReleaseFormState> {
  const parsed = QualityReleaseSchema.safeParse({
    releasedQuantity: formData.get("releasedQuantity") || undefined,
    rejectedQuantity: formData.get("rejectedQuantity") || undefined,
    status: formData.get("status"),
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const user = await requireCurrentUser();
  try {
    await requirePermission(user.roleId, "QualityRelease", "Create");
    await withScopedTransaction(async (tx) => {
      const qualityRelease = await tx.qualityRelease.create({
        data: { orgId: user.orgId, batchId, releasedBy: user.id, ...parsed.data },
      });
      await tx.batch.update({
        where: { id: batchId },
        data: { qualityStatus: QUALITY_RELEASE_TO_BATCH_STATUS[parsed.data.status] },
      });
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "qualityRelease.created",
        entityType: "QualityRelease",
        entityId: qualityRelease.id,
        afterValue: { batchId, ...parsed.data },
      });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "createQualityRelease", error: e });
    return { formError: "حصل خطأ أثناء تسجيل الإفراج عن الجودة — حاول تاني." };
  }

  revalidatePath(`/batches/${batchId}`);
  return {};
}

const BATCH_QUALITY_STATUSES = ["Pending", "Released", "Held", "Rejected"] as const;

const LotSchema = z.object({
  lotCode: z.string().trim().min(1, "كود الدفعة مطلوب"),
  packingDate: z.string().trim().optional().or(z.literal("")),
  quantity: z.coerce.number().min(0).optional(),
  cartons: z.coerce.number().int().min(0).optional(),
  pallets: z.coerce.number().int().min(0).optional(),
  netWeight: z.coerce.number().min(0).optional(),
  grossWeight: z.coerce.number().min(0).optional(),
  qualityStatus: z.enum(BATCH_QUALITY_STATUSES),
});

export type LotFormState = { errors?: Record<string, string[]>; formError?: string };

/** لو qualityStatus='Released' بلا QualityRelease معتمد، الـTrigger (enforce_lot_quality_release)
 * هيمنع الإنشاء على مستوى القاعدة مباشرة — نفس نمط createPurchaseOrder. */
export async function createLot(batchId: string, _prevState: LotFormState, formData: FormData): Promise<LotFormState> {
  const parsed = LotSchema.safeParse({
    lotCode: formData.get("lotCode"),
    packingDate: formData.get("packingDate") || undefined,
    quantity: formData.get("quantity") || undefined,
    cartons: formData.get("cartons") || undefined,
    pallets: formData.get("pallets") || undefined,
    netWeight: formData.get("netWeight") || undefined,
    grossWeight: formData.get("grossWeight") || undefined,
    qualityStatus: formData.get("qualityStatus"),
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const user = await requireCurrentUser();
  const { packingDate, ...rest } = parsed.data;
  try {
    await requirePermission(user.roleId, "Lot", "Create");
    await withScopedTransaction(async (tx) => {
      const lot = await tx.lot.create({
        data: { orgId: user.orgId, batchId, packingDate: packingDate ? new Date(packingDate) : undefined, ...rest },
      });
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "lot.created",
        entityType: "Lot",
        entityId: lot.id,
        afterValue: { batchId, ...rest },
      });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "createLot", error: e });
    // ⚠️ متعمّد ما بنرجعش e.message هنا — نفس نمط decideGate/createQuote (Prisma بيغلّف رسالة
    // الـTrigger جوه نص مطوّل فيه مسار الملف والاستعلام الخام).
    if (e instanceof Error && e.message.includes("مُفرَج عنها جودة")) {
      return { formError: "مينفعش تسجّل الدفعة (Lot) كـ\"مُفرَج عنها جودة\" (Released) من غير QualityRelease معتمد لنفس دفعة الإنتاج — سجّل إفراج جودة أولًا." };
    }
    return { formError: "حصل خطأ أثناء إضافة الدفعة (Lot) — حاول تاني." };
  }

  revalidatePath(`/batches/${batchId}`);
  return {};
}

const LAB_TEST_TYPES = [
  "Physical", "Chemical", "Microbiological", "PesticideResidues", "HeavyMetals", "Moisture", "Purity", "Aflatoxins", "Mycotoxins", "Allergens", "GMO",
] as const;
const LAB_TEST_PASS_FAIL = ["Pass", "Fail"] as const;

const LabTestSchema = z.object({
  inspectionId: z.string().uuid().optional().or(z.literal("")),
  supplierSampleId: z.string().uuid().optional().or(z.literal("")),
  testType: z.enum(LAB_TEST_TYPES),
  parameter: z.string().trim().optional().or(z.literal("")),
  unit: z.string().trim().optional().or(z.literal("")),
  minLimit: z.coerce.number().optional(),
  maxLimit: z.coerce.number().optional(),
  actualResult: z.coerce.number().optional(),
  laboratory: z.string().trim().optional().or(z.literal("")),
  isAccredited: z.coerce.boolean().optional(),
  passFail: z.enum(LAB_TEST_PASS_FAIL),
});

export type LabTestFormState = { errors?: Record<string, string[]>; formError?: string };

export async function createLabTest(batchId: string, _prevState: LabTestFormState, formData: FormData): Promise<LabTestFormState> {
  const parsed = LabTestSchema.safeParse({
    inspectionId: formData.get("inspectionId") || undefined,
    supplierSampleId: formData.get("supplierSampleId") || undefined,
    testType: formData.get("testType"),
    parameter: formData.get("parameter") || undefined,
    unit: formData.get("unit") || undefined,
    minLimit: formData.get("minLimit") || undefined,
    maxLimit: formData.get("maxLimit") || undefined,
    actualResult: formData.get("actualResult") || undefined,
    laboratory: formData.get("laboratory") || undefined,
    isAccredited: formData.get("isAccredited") === "on",
    passFail: formData.get("passFail"),
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const user = await requireCurrentUser();
  const { inspectionId, supplierSampleId, parameter, unit, laboratory, ...rest } = parsed.data;
  try {
    await requirePermission(user.roleId, "LabTest", "Create");
    await withScopedTransaction(async (tx) => {
      const labTest = await tx.labTest.create({
        data: {
          orgId: user.orgId,
          batchId,
          inspectionId: inspectionId || undefined,
          supplierSampleId: supplierSampleId || undefined,
          parameter: parameter || undefined,
          unit: unit || undefined,
          laboratory: laboratory || undefined,
          testDate: new Date(),
          ...rest,
        },
      });
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "labTest.created",
        entityType: "LabTest",
        entityId: labTest.id,
        afterValue: { batchId, ...rest },
      });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "createLabTest", error: e });
    return { formError: "حصل خطأ أثناء تسجيل الفحص المعملي — حاول تاني." };
  }

  revalidatePath(`/batches/${batchId}`);
  return {};
}

const BATCH_RAW_MATERIAL_SOURCE_TYPES = ["Farm", "IncomingInventory"] as const;

const BatchRawMaterialLineSchema = z
  .object({
    sourceType: z.enum(BATCH_RAW_MATERIAL_SOURCE_TYPES),
    farmId: z.string().uuid().optional().or(z.literal("")),
    inventoryId: z.string().uuid().optional().or(z.literal("")),
    quantity: z.coerce.number().min(0).optional(),
  })
  // ⚠️ superRefine مش refine — الرسالة لازم تتعلّق بالحقل الناقص الفعلي (farmId أو inventoryId)،
  // مش farmId دايمًا (باگ اتلقط: كان بيظهر تحت المزرعة حتى لو الناقص فعليًا سجل المخزون).
  .superRefine((v, ctx) => {
    if (v.sourceType === "Farm" && !v.farmId) {
      ctx.addIssue({ code: "custom", message: "اختر المزرعة", path: ["farmId"] });
    }
    if (v.sourceType === "IncomingInventory" && !v.inventoryId) {
      ctx.addIssue({ code: "custom", message: "اختر سجل المخزون", path: ["inventoryId"] });
    }
  });

export type BatchRawMaterialLineFormState = { errors?: Record<string, string[]>; formError?: string };

export async function createBatchRawMaterialLine(
  batchId: string,
  _prevState: BatchRawMaterialLineFormState,
  formData: FormData
): Promise<BatchRawMaterialLineFormState> {
  const parsed = BatchRawMaterialLineSchema.safeParse({
    sourceType: formData.get("sourceType"),
    farmId: formData.get("farmId") || undefined,
    inventoryId: formData.get("inventoryId") || undefined,
    quantity: formData.get("quantity") || undefined,
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const user = await requireCurrentUser();
  const { farmId, inventoryId, ...rest } = parsed.data;
  try {
    await requirePermission(user.roleId, "BatchRawMaterialLine", "Create");
    await withScopedTransaction(async (tx) => {
      const line = await tx.batchRawMaterialLine.create({
        data: {
          orgId: user.orgId,
          batchId,
          farmId: farmId || undefined,
          inventoryId: inventoryId || undefined,
          ...rest,
        },
      });
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "batchRawMaterialLine.created",
        entityType: "BatchRawMaterialLine",
        entityId: line.id,
        afterValue: { batchId, farmId, inventoryId, ...rest },
      });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "createBatchRawMaterialLine", error: e });
    return { formError: "حصل خطأ أثناء تسجيل مصدر الخام — حاول تاني." };
  }

  revalidatePath(`/batches/${batchId}`);
  return {};
}

const BATCH_MARKET_ELIGIBILITY_STATUSES = ["Eligible", "Conditional", "NotEligible", "NotAssessed"] as const;

const BatchMarketEligibilitySchema = z.object({
  marketId: z.string().uuid("اختر سوق"),
  status: z.enum(BATCH_MARKET_ELIGIBILITY_STATUSES),
  reason: z.string().trim().optional().or(z.literal("")),
});

export type BatchMarketEligibilityFormState = { errors?: Record<string, string[]>; formError?: string };

export async function createBatchMarketEligibility(
  batchId: string,
  _prevState: BatchMarketEligibilityFormState,
  formData: FormData
): Promise<BatchMarketEligibilityFormState> {
  const parsed = BatchMarketEligibilitySchema.safeParse({
    marketId: formData.get("marketId"),
    status: formData.get("status"),
    reason: formData.get("reason") || undefined,
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const user = await requireCurrentUser();
  const { reason, ...rest } = parsed.data;
  try {
    await requirePermission(user.roleId, "BatchMarketEligibility", "Create");
    await withScopedTransaction(async (tx) => {
      const eligibility = await tx.batchMarketEligibility.create({
        data: { orgId: user.orgId, batchId, assessedBy: user.id, reason: reason || undefined, ...rest },
      });
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "batchMarketEligibility.created",
        entityType: "BatchMarketEligibility",
        entityId: eligibility.id,
        afterValue: { batchId, ...rest },
      });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "createBatchMarketEligibility", error: e });
    return { formError: "حصل خطأ أثناء تسجيل أهلية السوق — حاول تاني." };
  }

  revalidatePath(`/batches/${batchId}`);
  return {};
}
