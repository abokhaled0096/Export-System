import { z } from "zod";
import { CURRENCY_CODES } from "@/lib/currencies";

/**
 * التحقق من العملة على السيرفر.
 *
 * ⚠️ ملف منفصل عن `currencies.ts` عن قصد: `currencies.ts` بيتستورد في مكوّن عميل
 * (`CurrencySelect`)، ومفيش داعي نجرّ `zod` كله للمتصفح معاه.
 *
 * `length(3)` القديمة كانت بتقبل "XXX" و"eur " و"ABC" — أي ٣ حروف. وده مش تفصيلة شكلية:
 * العملة بتتقارن حرفيًا في تخصيص الدفعات على الفواتير، وفي اختيار حساب النقدية بالعملة،
 * وفي إعادة تقييم فروق العملة. قيمة غلط بتعدّي التحقق وبعدين الفاتورة مابتتخصّصش عليها
 * دفعة ومحدش يعرف السبب.
 */

const CODES = CURRENCY_CODES as [string, ...string[]];

/** عملة مطلوبة — بتقبل حروف صغيرة وبتحوّلها لكابيتال قبل التحقق. */
export const currencySchema = z.string().trim().toUpperCase().pipe(z.enum(CODES, "اختار عملة من القايمة"));

/** عملة اختيارية — بتقبل الفراغ زي ما كان الحال قبل كده. */
export const optionalCurrencySchema = currencySchema.optional().or(z.literal(""));
