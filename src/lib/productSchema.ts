import { z } from "zod";

// z.union([z.string(), z.number()]) بقصد — الحقل ده بيتفحص مرتين: مرة من FormData (قيم نصية)
// وقت الإنشاء المباشر أو تسجيل طلب MasterDataChangeRequest، ومرة تانية من JSON مخزَّن (أرقام
// بعد التحويل الأول) وقت اعتماد الطلب في createEntityFromChangeRequest — لو الحقل قبل نص بس،
// إعادة الفحص بعد التحويل الأول كانت بترمي خطأ Zod دايمًا وتمنع اعتماد أي طلب فيه شهور متحدّدة.
const monthsField = z
  .array(z.union([z.string(), z.number()]))
  .transform((arr) => arr.map(Number))
  .pipe(z.array(z.number().int().min(1, "شهر غير صالح").max(12, "شهر غير صالح")))
  .optional();

/** مفصولة عن src/app/products/actions.ts لأنها "use server" file، وملفات "use server" في
 * Next.js الحديث ممنوع تصدّر غير async functions — الـschema ده بيتستخدم كمان في
 * src/app/governance/actions.ts (إعادة تحقق MasterDataChangeRequest)، نفس نمط CompanySchema. */
export const ProductSchema = z.object({
  nameAr: z.string().trim().min(2, "الاسم بالعربية لازم يكون حرفين على الأقل"),
  nameEn: z.string().trim().min(2, "الاسم بالإنجليزية لازم يكون حرفين على الأقل"),
  hsCode: z.string().trim().min(4, "HS Code غير صالح"),
  category: z.string().trim().min(1, "الفئة مطلوبة"),
  originCountry: z.string().trim().min(1, "بلد المنشأ مطلوب"),
  harvestSeason: z.string().trim().optional(),
  availableMonths: monthsField,
  storageTempC: z.coerce.number().min(-30, "درجة الحرارة لازم تكون -30 أو أكتر").max(50, "درجة الحرارة لازم تكون 50 أو أقل").optional(),
  shelfLifeDays: z.coerce.number().int().positive("لازم يكون أكبر من صفر").optional(),
  requiresRefrigeration: z.coerce.boolean().optional(),
  confirmDuplicate: z.coerce.boolean().optional(),
});
