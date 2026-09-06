export const PAGE_SIZE = 25;

/** بيحوّل searchParams.page لرقم صفحة صالح (1 لو غير موجود/غير صالح). */
export function parsePage(page: string | undefined): number {
  const n = Number(page);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}
