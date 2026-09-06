import { z } from "zod";

/** مفصولة عن src/app/companies/actions.ts لأنها "use server" file، وملفات "use server" في
 * Next.js الحديث ممنوع تصدّر غير async functions — الـschema ده بيتستخدم كمان في
 * src/app/governance/actions.ts (إعادة تحقق MasterDataChangeRequest)، فمحتاج ملف منفصل. */
export const CompanySchema = z.object({
  legalName: z.string().trim().min(2, "الاسم القانوني مطلوب"),
  tradeName: z.string().trim().optional(),
  country: z.string().trim().min(1, "الدولة مطلوبة"),
  city: z.string().trim().optional(),
  classification: z.string().trim().min(1, "اختر تصنيف واحد على الأقل"),
});
