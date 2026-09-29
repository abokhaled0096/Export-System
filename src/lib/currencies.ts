/**
 * العملات المتاحة في السيستم.
 *
 * ليه قايمة مقفولة بدل خانة نص مفتوحة: `currency` في القاعدة `Char(3)` وبيتقارن حرفيًا في
 * حتت كتير حسّاسة — تخصيص الدفعات على الفواتير، حساب النقدية حسب العملة
 * (`resolveCashAccountId`)، إعادة تقييم فروق العملة، والتحقق إن عملة الدفعة تطابق عملة
 * الفاتورة. خانة نص بتسمح بـ"eur" و"Eu " و"يورو" — وكلهم بيعدّوا التحقق الشكلي وبعدين
 * الفاتورة مابتتخصّصش عليها دفعة ومحدش يعرف ليه.
 *
 * القايمة دي هي عملات التصدير المصري الفعلية + عملات الخليج الأساسية. لو احتاجت زيادة،
 * الإضافة هنا بس — الكود كله بياخد منها.
 */

export type CurrencyOption = { code: string; nameAr: string };

export const CURRENCIES: CurrencyOption[] = [
  { code: "EGP", nameAr: "جنيه مصري" },
  { code: "USD", nameAr: "دولار أمريكي" },
  { code: "EUR", nameAr: "يورو" },
  { code: "GBP", nameAr: "جنيه إسترليني" },
  { code: "SAR", nameAr: "ريال سعودي" },
  { code: "AED", nameAr: "درهم إماراتي" },
  { code: "KWD", nameAr: "دينار كويتي" },
  { code: "QAR", nameAr: "ريال قطري" },
  { code: "JOD", nameAr: "دينار أردني" },
  { code: "CNY", nameAr: "يوان صيني" },
  { code: "JPY", nameAr: "ين ياباني" },
  { code: "CHF", nameAr: "فرنك سويسري" },
  { code: "TRY", nameAr: "ليرة تركية" },
  { code: "CAD", nameAr: "دولار كندي" },
  { code: "AUD", nameAr: "دولار أسترالي" },
];

export const CURRENCY_CODES = CURRENCIES.map((c) => c.code);

const BY_CODE = new Map(CURRENCIES.map((c) => [c.code, c]));

/** "EUR — يورو"، أو الكود زي ما هو لو مش في القايمة (بيانات قديمة مثلًا). */
export function currencyLabel(code: string | null | undefined): string {
  if (!code) return "—";
  const c = BY_CODE.get(code.toUpperCase());
  return c ? `${c.code} — ${c.nameAr}` : code;
}
