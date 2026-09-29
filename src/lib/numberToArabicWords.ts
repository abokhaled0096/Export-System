/**
 * تفقيط المبالغ بالعربي — كتابة الرقم حروفًا.
 *
 * ليه موجود: الفاتورة التجارية وخطاب الاعتماد لازم يكون فيهم الإجمالي **كتابةً** جنب
 * الأرقام. البنك المراسل بيقارن الاتنين، والجمارك بترفض مستند بلا تفقيط. مفيش مكتبة
 * عربية موثوقة صغيرة للغرض ده، فمكتوب هنا ومغطّى باختبارات في prisma/statements-test.ts.
 *
 * القواعد المطبَّقة (صرف عربي قياسي):
 * - المثنّى: ألفان، مليونان، مائتان — مش "اثنان ألف".
 * - جمع القلّة (٣–١٠): ثلاثة آلاف، خمسة ملايين. وما فوقها مفرد: أحد عشر ألفًا.
 * - العطف بالعشرات: واحد وعشرون، خمسة وأربعون.
 * - الكسور بتتقرّب لمنزلتين (قرش/سنت) وبتتكتب لو مش صفر.
 */

const ONES = ["", "واحد", "اثنان", "ثلاثة", "أربعة", "خمسة", "ستة", "سبعة", "ثمانية", "تسعة"];
const TEENS = [
  "عشرة", "أحد عشر", "اثنا عشر", "ثلاثة عشر", "أربعة عشر",
  "خمسة عشر", "ستة عشر", "سبعة عشر", "ثمانية عشر", "تسعة عشر",
];
const TENS = ["", "", "عشرون", "ثلاثون", "أربعون", "خمسون", "ستون", "سبعون", "ثمانون", "تسعون"];
const HUNDREDS = ["", "مائة", "مائتان", "ثلاثمائة", "أربعمائة", "خمسمائة", "ستمائة", "سبعمائة", "ثمانمائة", "تسعمائة"];

/** صيغ كل مرتبة: [مفرد، مثنّى، جمع] */
const SCALES: [string, string, string][] = [
  ["", "", ""],
  ["ألف", "ألفان", "آلاف"],
  ["مليون", "مليونان", "ملايين"],
  ["مليار", "ملياران", "مليارات"],
];

/** بيحوّل عدد من 1 لـ999 لحروف. */
function under1000(n: number): string {
  const parts: string[] = [];
  const h = Math.floor(n / 100);
  const rest = n % 100;
  if (h > 0) parts.push(HUNDREDS[h]);

  if (rest >= 10 && rest < 20) {
    parts.push(TEENS[rest - 10]);
  } else {
    const t = Math.floor(rest / 10);
    const o = rest % 10;
    // العطف بيبدأ بالآحاد في العربي: "خمسة وأربعون" مش "أربعون وخمسة".
    if (o > 0 && t >= 2) parts.push(`${ONES[o]} و${TENS[t]}`);
    else if (t >= 2) parts.push(TENS[t]);
    else if (o > 0) parts.push(ONES[o]);
  }
  return parts.join(" و");
}

/** بيصرّف المرتبة حسب عددها: ألف / ألفان / ثلاثة آلاف / أحد عشر ألفًا. */
function withScale(count: number, scaleIndex: number): string {
  const [singular, dual, plural] = SCALES[scaleIndex];
  if (scaleIndex === 0) return under1000(count);
  if (count === 1) return singular;
  if (count === 2) return dual;
  if (count >= 3 && count <= 10) return `${under1000(count)} ${plural}`;
  return `${under1000(count)} ${singular}`;
}

function integerToWords(n: number): string {
  if (n === 0) return "صفر";

  const groups: number[] = [];
  let rest = n;
  while (rest > 0) {
    groups.push(rest % 1000);
    rest = Math.floor(rest / 1000);
  }
  if (groups.length > SCALES.length) return String(n); // أكبر من المليارات — رجّع الرقم زي ما هو

  const parts: string[] = [];
  for (let i = groups.length - 1; i >= 0; i--) {
    if (groups[i] === 0) continue;
    parts.push(withScale(groups[i], i));
  }
  return parts.join(" و");
}

/** أسماء العملات الشائعة في التصدير — الافتراضي بيستخدم رمز العملة زي ما هو. */
const CURRENCY_NAMES: Record<string, { major: string; minor: string }> = {
  EGP: { major: "جنيه مصري", minor: "قرش" },
  USD: { major: "دولار أمريكي", minor: "سنت" },
  EUR: { major: "يورو", minor: "سنت" },
  GBP: { major: "جنيه إسترليني", minor: "بنس" },
  SAR: { major: "ريال سعودي", minor: "هللة" },
  AED: { major: "درهم إماراتي", minor: "فلس" },
};

/**
 * بيرجّع المبلغ مكتوبًا بالحروف مع اسم العملة.
 * مثال: `amountToArabicWords("3216.15", "EUR")` → «فقط ثلاثة آلاف ومائتان وستة عشر يورو وخمسة عشر سنتًا لا غير».
 */
export function amountToArabicWords(amount: { toString(): string } | number, currency: string): string {
  const n = typeof amount === "number" ? amount : Number(amount.toString());
  if (!Number.isFinite(n)) return "—";

  const negative = n < 0;
  const abs = Math.abs(n);
  const major = Math.floor(abs);
  // التقريب على القروش قبل الفصل — 0.155 المفروض تبقى 16 قرش مش 15.
  const minor = Math.round((abs - major) * 100);

  const names = CURRENCY_NAMES[currency.toUpperCase()] ?? { major: currency.toUpperCase(), minor: "" };

  let text = `${integerToWords(major)} ${names.major}`;
  if (minor > 0 && names.minor) text += ` و${integerToWords(minor)} ${names.minor}`;

  return `${negative ? "سالب " : ""}فقط ${text} لا غير`;
}
