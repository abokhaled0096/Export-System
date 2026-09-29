import { z } from "zod";
import { currencySchema } from "@/lib/currencySchema";

/** مفصولة عن src/app/sourcing/actions.ts لأنها "use server" file، وملفات "use server" في
 * Next.js الحديث ممنوع تصدّر غير async functions — الـschema ده بيتستخدم كمان في
 * src/app/governance/actions.ts (إعادة تحقق MasterDataChangeRequest)، نفس نمط CompanySchema. */
export const PurchaseOrderSchema = z.object({
  supplierId: z.string().uuid("اختر مورّد"),
  facilityId: z.string().uuid().optional().or(z.literal("")),
  specificationId: z.string().uuid().optional().or(z.literal("")),
  quantity: z.coerce.number().positive("الكمية مطلوبة"),
  unitPrice: z.coerce.number().positive("سعر الوحدة مطلوب"),
  currency: currencySchema,
  paymentTerms: z.string().trim().optional().or(z.literal("")),
  penalties: z.string().trim().optional().or(z.literal("")),
});
