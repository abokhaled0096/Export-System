import { z } from "zod";

/** مفصولة عن src/app/suppliers/actions.ts لأنها "use server" file، وممنوع تصدّر غير async
 * functions — الـschema ده بيتستخدم كمان في src/app/governance/actions.ts (إعادة تحقق
 * MasterDataChangeRequest). */
export const SUPPLIER_TYPES = [
  "Farm", "Farmer", "Aggregator", "Trader", "Processor", "Manufacturer", "PackingHouse", "FreezingFacility", "DryingFacility", "PackagingSupplier", "Warehouse", "ColdStore", "Laboratory",
] as const;

export const SupplierSchema = z.object({
  legalName: z.string().trim().min(1, "الاسم القانوني مطلوب"),
  tradeName: z.string().trim().optional().or(z.literal("")),
  country: z.string().trim().optional().or(z.literal("")),
  governorate: z.string().trim().optional().or(z.literal("")),
  city: z.string().trim().optional().or(z.literal("")),
  taxId: z.string().trim().optional().or(z.literal("")),
  commercialRegNo: z.string().trim().optional().or(z.literal("")),
  supplierType: z.array(z.enum(SUPPLIER_TYPES, "اختار نوع مورّد صحيح")).optional(),
});
