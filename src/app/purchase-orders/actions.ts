"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getScopedPrisma, withScopedTransaction } from "@/lib/scoped-prisma";
import { requireCurrentUser } from "@/lib/session";
import { requirePermission } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { logError, isNextControlFlowError } from "@/lib/errorLog";

const BatchSchema = z
  .object({
    facilityId: z.string().uuid("اختر منشأة"),
    batchCode: z.string().trim().min(1, "كود الدفعة مطلوب"),
    productionDate: z.string().trim().optional().or(z.literal("")),
    expiryDate: z.string().trim().optional().or(z.literal("")),
    quantityInput: z.coerce.number().positive("الكمية المدخلة مطلوبة"),
    quantityOutput: z.coerce.number().min(0).optional(),
  })
  // ⚠️ باگ اتلقط في مراجعة وحدة 7: مفيش تحقق قبل كده يمنع الكمية المخرجة تتجاوز الكمية
  // المدخلة — ده كان بيسمح بنسبة استخلاص فوق 100% وهدر سالب في العرض المحسوب (⚙️).
  .refine((v) => v.quantityOutput == null || v.quantityOutput <= v.quantityInput, {
    message: "الكمية المخرجة مينفعش تتجاوز الكمية المدخلة",
    path: ["quantityOutput"],
  });

export type BatchFormState = { errors?: Record<string, string[]>; formError?: string };

/** supplierId بيتشتق من الـPurchaseOrder مباشرة (مش إدخال مستخدم) — نفس نمط
 * createSourcingRequest اللي بيشتق productId/marketId من الصفقة. */
export async function createBatch(purchaseOrderId: string, _prevState: BatchFormState, formData: FormData): Promise<BatchFormState> {
  const parsed = BatchSchema.safeParse({
    facilityId: formData.get("facilityId"),
    batchCode: formData.get("batchCode"),
    productionDate: formData.get("productionDate") || undefined,
    expiryDate: formData.get("expiryDate") || undefined,
    quantityInput: formData.get("quantityInput"),
    quantityOutput: formData.get("quantityOutput") || undefined,
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const user = await requireCurrentUser();
  const { productionDate, expiryDate, ...rest } = parsed.data;
  try {
    await requirePermission(user.roleId, "Batch", "Create");
    const scopedPrisma = await getScopedPrisma();
    const purchaseOrder = await scopedPrisma.purchaseOrder.findUniqueOrThrow({ where: { id: purchaseOrderId } });

    await withScopedTransaction(async (tx) => {
      const batch = await tx.batch.create({
        data: {
          orgId: user.orgId,
          purchaseOrderId,
          supplierId: purchaseOrder.supplierId,
          productionDate: productionDate ? new Date(productionDate) : undefined,
          expiryDate: expiryDate ? new Date(expiryDate) : undefined,
          ...rest,
        },
      });
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "batch.created",
        entityType: "Batch",
        entityId: batch.id,
        afterValue: { purchaseOrderId, ...rest },
      });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "createBatch", error: e });
    return { formError: "حصل خطأ أثناء إضافة الدفعة — حاول تاني." };
  }

  revalidatePath(`/purchase-orders/${purchaseOrderId}`);
  return {};
}

const PRODUCTION_PROCESSES = [
  "Sorting", "Grading", "Washing", "Cutting", "Peeling", "Freezing", "Drying", "Milling", "Sterilization", "Fumigation", "Extraction", "Mixing", "Packing", "Labeling", "Palletizing",
] as const;

const ProductionPlanSchema = z.object({
  facilityId: z.string().uuid("اختر منشأة"),
  process: z.enum(PRODUCTION_PROCESSES),
  rawQuantity: z.coerce.number().min(0).optional(),
  targetYield: z.coerce.number().min(0).max(1).optional(),
  startDate: z.string().trim().optional().or(z.literal("")),
  endDate: z.string().trim().optional().or(z.literal("")),
  cargoReadyDate: z.string().trim().optional().or(z.literal("")),
});

export type ProductionPlanFormState = { errors?: Record<string, string[]>; formError?: string };

export async function createProductionPlan(
  purchaseOrderId: string,
  _prevState: ProductionPlanFormState,
  formData: FormData
): Promise<ProductionPlanFormState> {
  const parsed = ProductionPlanSchema.safeParse({
    facilityId: formData.get("facilityId"),
    process: formData.get("process"),
    rawQuantity: formData.get("rawQuantity") || undefined,
    targetYield: formData.get("targetYield") || undefined,
    startDate: formData.get("startDate") || undefined,
    endDate: formData.get("endDate") || undefined,
    cargoReadyDate: formData.get("cargoReadyDate") || undefined,
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const user = await requireCurrentUser();
  const { startDate, endDate, cargoReadyDate, ...rest } = parsed.data;
  try {
    await requirePermission(user.roleId, "ProductionPlan", "Create");
    await withScopedTransaction(async (tx) => {
      const plan = await tx.productionPlan.create({
        data: {
          orgId: user.orgId,
          purchaseOrderId,
          startDate: startDate ? new Date(startDate) : undefined,
          endDate: endDate ? new Date(endDate) : undefined,
          cargoReadyDate: cargoReadyDate ? new Date(cargoReadyDate) : undefined,
          ...rest,
        },
      });
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "productionPlan.created",
        entityType: "ProductionPlan",
        entityId: plan.id,
        afterValue: { purchaseOrderId, ...rest },
      });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "createProductionPlan", error: e });
    return { formError: "حصل خطأ أثناء إضافة خطة الإنتاج — حاول تاني." };
  }

  revalidatePath(`/purchase-orders/${purchaseOrderId}`);
  return {};
}

const CARGO_READINESS_STATUSES = [
  "NotStarted", "MaterialsPending", "InProduction", "QualityHold", "PartialReady", "ReadyWithConditions", "CargoReady", "LoadingReleased", "Blocked", "Cancelled",
] as const;

const CargoReadinessSchema = z.object({
  shipmentId: z.string().uuid("اختر شحنة"),
  readinessScore: z.coerce.number().min(0).max(100).optional(),
  status: z.enum(CARGO_READINESS_STATUSES),
  readyDate: z.string().trim().optional().or(z.literal("")),
  pickupLocation: z.string().trim().optional().or(z.literal("")),
});

export type CargoReadinessFormState = { errors?: Record<string, string[]>; formError?: string };

/** blockingIssues/handoverPayload بلا واجهة إدخال — نفس معاملة Farm.pesticideProgram. */
export async function createCargoReadiness(purchaseOrderId: string, _prevState: CargoReadinessFormState, formData: FormData): Promise<CargoReadinessFormState> {
  const parsed = CargoReadinessSchema.safeParse({
    shipmentId: formData.get("shipmentId"),
    readinessScore: formData.get("readinessScore") || undefined,
    status: formData.get("status"),
    readyDate: formData.get("readyDate") || undefined,
    pickupLocation: formData.get("pickupLocation") || undefined,
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const user = await requireCurrentUser();
  const { readyDate, pickupLocation, ...rest } = parsed.data;
  try {
    await requirePermission(user.roleId, "CargoReadiness", "Create");
    await withScopedTransaction(async (tx) => {
      const readiness = await tx.cargoReadiness.create({
        data: {
          orgId: user.orgId,
          purchaseOrderId,
          readyDate: readyDate ? new Date(readyDate) : undefined,
          pickupLocation: pickupLocation || undefined,
          ...rest,
        },
      });
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "cargoReadiness.created",
        entityType: "CargoReadiness",
        entityId: readiness.id,
        afterValue: { purchaseOrderId, ...rest },
      });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "createCargoReadiness", error: e });
    return { formError: "حصل خطأ أثناء تسجيل جاهزية الشحن — حاول تاني." };
  }

  revalidatePath(`/purchase-orders/${purchaseOrderId}`);
  return {};
}
