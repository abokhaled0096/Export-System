"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getScopedPrisma, withScopedTransaction } from "@/lib/scoped-prisma";
import { requireCurrentUser } from "@/lib/session";
import { requirePermission } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { logError, isNextControlFlowError } from "@/lib/errorLog";
import { optionalCurrencySchema } from "@/lib/currencySchema";

const INVENTORY_TYPES = ["RawMaterial", "WIP", "FinishedGoods", "PackagingMaterial"] as const;
const INVENTORY_STATUSES = [
  "Expected", "Received", "Quarantine", "Accepted", "Conditional", "Rejected", "Reserved", "InProduction", "Consumed", "Expired",
] as const;

const InventorySchema = z.object({
  productId: z.string().uuid("اختر منتج"),
  batchId: z.string().uuid().optional().or(z.literal("")),
  lotId: z.string().uuid().optional().or(z.literal("")),
  inventoryType: z.enum(INVENTORY_TYPES, "اختار نوع مخزون صحيح"),
  quantity: z.coerce.number().positive("الكمية مطلوبة"),
  unit: z.string().trim().optional().or(z.literal("")),
  location: z.string().trim().optional().or(z.literal("")),
  status: z.enum(INVENTORY_STATUSES, "اختار حالة مخزون صحيحة"),
  expiryDate: z.string().trim().optional().or(z.literal("")),
  unitCost: z.coerce.number().min(0, "لازم يكون 0 أو أكتر").optional(),
  currency: optionalCurrencySchema,
});

/** `ok` بيتضبط عند النجاح عشان الواجهة تقدر تفرّق النجاح عن الحالة الابتدائية
 *  (الاتنين كانوا `{}`) — محتاجها النافذة عشان تقفل نفسها. */
export type InventoryFormState = { errors?: Record<string, string[]>; formError?: string; ok?: boolean };

export async function createInventory(_prevState: InventoryFormState, formData: FormData): Promise<InventoryFormState> {
  const parsed = InventorySchema.safeParse({
    productId: formData.get("productId"),
    batchId: formData.get("batchId") || undefined,
    lotId: formData.get("lotId") || undefined,
    inventoryType: formData.get("inventoryType"),
    quantity: formData.get("quantity"),
    unit: formData.get("unit") || undefined,
    location: formData.get("location") || undefined,
    status: formData.get("status"),
    expiryDate: formData.get("expiryDate") || undefined,
    unitCost: formData.get("unitCost") || undefined,
    currency: formData.get("currency") || undefined,
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const user = await requireCurrentUser();
  const { batchId, lotId, unit, location, expiryDate, currency, ...rest } = parsed.data;
  try {
    await requirePermission(user.roleId, "Inventory", "Create");
    // productId إلزامي وبيتعرض بلا `?.` في `/inventory` (`r.product.nameAr`) — لازم يتحقق قبل
    // الإنشاء (اتكشف في مراجعة وحدة 7، 6 سبتمبر).
    const scopedPrisma = await getScopedPrisma();
    const product = await scopedPrisma.product.findFirst({ where: { id: rest.productId, deletedAt: null } });
    if (!product) return { formError: "المنتج غير موجود." };
    // batchId/lotId اختياريين جايين من الفورم — لازم يتأكدوا إنهم بتوع نفس المنظمة قبل الإنشاء
    // (اتكشف في إعادة مراجعة وحدة 7، 7 سبتمبر).
    if (batchId) {
      const batch = await scopedPrisma.batch.findFirst({ where: { id: batchId } });
      if (!batch) return { formError: "الدفعة غير موجودة." };
    }
    if (lotId) {
      const lot = await scopedPrisma.lot.findFirst({ where: { id: lotId } });
      if (!lot) return { formError: "الدفعة (Lot) غير موجودة." };
    }
    await withScopedTransaction(async (tx) => {
      const inventory = await tx.inventory.create({
        data: {
          orgId: user.orgId,
          batchId: batchId || undefined,
          lotId: lotId || undefined,
          unit: unit || undefined,
          location: location || undefined,
          expiryDate: expiryDate ? new Date(expiryDate) : undefined,
          currency: currency || undefined,
          ...rest,
        },
      });
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "inventory.created",
        entityType: "Inventory",
        entityId: inventory.id,
        afterValue: { batchId, lotId, ...rest },
      });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "createInventory", error: e });
    return { formError: "حصل خطأ أثناء إضافة سجل المخزون — حاول تاني." };
  }

  revalidatePath("/inventory");
  return { ok: true };
}
