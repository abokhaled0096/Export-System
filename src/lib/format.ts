/**
 * تنسيق موحَّد للتواريخ والأرقام في كل الواجهة.
 *
 * ليه ملف واحد بدل `toLocaleDateString` في كل صفحة:
 *
 * 1. **المنطقة الزمنية.** السيرفر على Vercel بيشتغل بـUTC. تاريخ متخزّن 2026-09-29T22:00:00Z
 *    بيتعرض "29/09" بتوقيت UTC لكنه فعليًا "30/09" بتوقيت القاهرة. في نظام مواعيد استحقاق
 *    وشحنات، اليوم الغلط ده فرق حقيقي. كل الدوال هنا بتثبّت `Africa/Cairo`.
 *
 * 2. **الأرقام العربية-الهندية.** `toLocaleDateString("ar-EG")` بيطلّع ٢٩‏/٩‏/٢٠٢٦ بعلامات
 *    اتجاه مدسوسة، جنب مبالغ متكتبة بأرقام لاتينية (`toFixed(2)`) في نفس الجدول. الخلط ده
 *    بيبوّظ محاذاة الأعمدة ويصعّب المسح البصري لجدول مالي. القرار: أرقام لاتينية في كل حتة،
 *    وصيغة dd/mm/yyyy المستخدمة في المستندات التجارية المصرية.
 *
 * 3. **الاتساق.** كانت فيه صيغتين في الكود: `toLocaleDateString("ar-EG")` في ٤٩ موضع
 *    و`toISOString().slice(0, 10)` (yyyy-mm-dd، وبتوقيت UTC) في ٢٦ موضع.
 */

const TZ = "Africa/Cairo";

/** dd/mm/yyyy بتوقيت القاهرة — مثال: 29/09/2026 */
const dateFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: TZ,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

/** dd/mm/yyyy HH:mm بنظام 24 ساعة — مثال: 29/09/2026 16:30 */
const dateTimeFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: TZ,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** yyyy-mm-dd بتوقيت القاهرة — للاستخدام في `<input type="date">` بس. */
const inputFmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric" });

export function formatDate(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return dateFmt.format(date);
}

export function formatDateTime(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return dateTimeFmt.format(date).replace(", ", " ");
}

/**
 * القيمة اللي `<input type="date">` بيفهمها (yyyy-mm-dd). ⚠️ استخدم دي بدل
 * `toISOString().slice(0, 10)` — دي بتاعة UTC وبتزحلق اليوم لبره توقيت القاهرة.
 */
export function toDateInputValue(value: Date | string | null | undefined): string {
  if (!value) return "";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  return inputFmt.format(date);
}

/** فاصل آلاف وأرقام لاتينية — مثال: 1,234,567.89 */
export function formatNumber(value: { toString(): string } | number | null | undefined, decimals = 2): string {
  if (value === null || value === undefined) return "—";
  const n = typeof value === "number" ? value : Number(value.toString());
  if (Number.isNaN(n)) return "—";
  return n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

/** مبلغ بعملته — مثال: 1,234.56 EUR. العملة بتتساب فاضية لو مش متبعتة. */
export function formatMoney(value: { toString(): string } | number | null | undefined, currency?: string | null): string {
  const amount = formatNumber(value, 2);
  if (amount === "—") return amount;
  return currency ? `${amount} ${currency}` : amount;
}

/** سنة التاريخ **بتوقيت القاهرة** — لتوليد أرقام المستندات (INV-2026-…, PAY-2026-…). */
const yearFmt = new Intl.DateTimeFormat("en-US", { timeZone: TZ, year: "numeric" });

/**
 * ⚠️ استخدم دي بدل `getFullYear()` في أي ترقيم مشتقّ من تاريخ.
 *
 * `getFullYear()` بتقرا التوقيت المحلي **للسيرفر**، يعني نفس الكود بيدّي رقم مختلف على
 * جهاز التطوير (القاهرة) وعلى Vercel (UTC) — والاتنين ممكن يبقوا غلط من منظور الشركة.
 * فاتورة اتعملت الساعة 1 صباحًا يوم 1 يناير بتوقيت القاهرة هي فاتورة **السنة الجديدة**
 * حتى لو UTC لسه في 31 ديسمبر. الترقيم لازم يتبع تقويم الشركة، مش تقويم السيرفر.
 */
export function businessYear(value: Date | string): number {
  const date = typeof value === "string" ? new Date(value) : value;
  return Number(yearFmt.format(date));
}
