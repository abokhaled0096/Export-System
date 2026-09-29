import Papa from "papaparse";
import { createHash } from "crypto";
import { formatDate } from "@/lib/format";

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
  if (value instanceof Date) return formatDate(value);
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

/** UUID حتمي (نفس المدخلات = نفس الخرج دايمًا) — أساس منع استيراد نفس الصف مرتين من نفس
 * الملف أو ملفين متداخلين، بلا ما نعتمد على وجود رقم مرجعي حقيقي من البنك. مش عشوائي عمدًا. */
export function deterministicUuid(parts: (string | number)[]): string {
  const hex = createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}
