import Papa from "papaparse";
import { createHash } from "crypto";

/** بيولّد نص CSV من صفوف كائنات — الأعمدة بترتيب `columns` بالظبط. */
export function toCsv<T extends Record<string, unknown>>(
  rows: T[],
  columns: { key: keyof T; label: string }[]
): string {
  const header = columns.map((c) => c.label);
  const body = rows.map((row) => columns.map((c) => formatCell(row[c.key])));
  return Papa.unparse([header, ...body]);
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.join("؛ ");
  // ⚠️ ISO عن قصد، مش صيغة العرض dd/mm/yyyy: الملف ده بيانات بتتفتح في Excel وبتترفع
  // لأنظمة تانية. Excel بلغة إنجليزية بيقرا 01/02/2026 على إنه ٢ يناير، وISO بيتفرز صح
  // كنص. صيغة العرض للشاشة بس.
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object" && "toString" in value) return String(value); // Prisma.Decimal
  return String(value);
}

export type CsvParseResult<T> = {
  rows: T[];
  errors: { row: number; message: string }[];
};

/** بيقرأ ملف CSV ويرجّع صفوف كـobjects بمفاتيح = اسم العمود في السطر الأول (header row). */
export function parseCsv(text: string): { data: Record<string, string>[]; errors: string[] } {
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });
  return {
    data: result.data,
    errors: result.errors.map((e) => `سطر ${e.row != null ? e.row + 2 : "?"}: ${e.message}`),
  };
}

/**
 * UUID حتمي (نفس المدخلات = نفس الخرج دايمًا) — أساس منع استيراد نفس الصف مرتين من نفس
 * الملف أو ملفين متداخلين، بلا ما نعتمد على وجود رقم مرجعي حقيقي من البنك. مش عشوائي عمدًا.
 *
 * ⚠️ **لازم يتضبط فيه رقم الإصدار وبتّات الـvariant.** قبل كده كانت الدالة بتقصّ هاش
 * SHA-256 على شكل UUID وخلاص، من غير ما تضبطهم — فالناتج كان "شكله UUID" بس مش UUID
 * صالح حسب RFC 9562. Postgres بيقبله في عمود uuid عادي، لكن `z.uuid()` بترفضه، واحتمال
 * إن هاش عشوائي يطلع صالح بالصدفة = 1/64 بس.
 *
 * النتيجة كانت إن **استيراد كشف الحساب البنكي مكانش بينجح أبدًا**: المعاينة بتعدّي
 * (مابتعملش إعادة فحص)، وخطوة التأكيد بتعيد فحص كل صف بـ`ConfirmableRowSchema` وبترجع
 * «بيانات المعاينة تالفة — ابدأ الاستيراد من الأول» دايمًا. العيب كان مستخبّي ورا بوابة
 * الـMFA — محدش وصل لخطوة التأكيد أصلًا عشان يكتشفه. (اتكشف أول ما فعّلنا MFA، 1 أكتوبر.)
 *
 * الإصدار 8 هو المخصَّص في RFC 9562 للقيم المشتقّة/المخصَّصة زي دي — مش 4، لأن ده مش عشوائي.
 */
export function deterministicUuid(parts: (string | number)[]): string {
  const hex = createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 32);
  const bytes = Buffer.from(hex, "hex");
  bytes[6] = (bytes[6] & 0x0f) | 0x80; // الإصدار 8 (قيمة مخصَّصة مشتقّة من هاش)
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant بتاع RFC 9562 (10xx)
  const out = bytes.toString("hex");
  return `${out.slice(0, 8)}-${out.slice(8, 12)}-${out.slice(12, 16)}-${out.slice(16, 20)}-${out.slice(20, 32)}`;
}
