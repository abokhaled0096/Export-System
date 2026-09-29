import { z } from "zod";
import { currencySchema } from "@/lib/currencySchema";

/** مفصولة عن src/app/accounting/arap-actions.ts لأنها "use server" file، وممنوع تصدّر غير
 * async functions — الـschema ده بيتستخدم كمان في src/app/governance/actions.ts (إعادة تحقق
 * MasterDataChangeRequest). */
export const BankAccountSchema = z.object({
  accountName: z.string().trim().min(1, "اسم الحساب مطلوب"),
  bankName: z.string().trim().min(1, "اسم البنك مطلوب"),
  currency: currencySchema,
  openingBalance: z.coerce.number().optional(),
});
