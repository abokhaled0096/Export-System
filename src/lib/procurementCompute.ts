// حسابات ⚙️ مشتركة لوحدة 7 (مش أعمدة مخزَّنة، بتتحسب وقت العرض دايمًا) — كانت مكرَّرة بالحرف
// في src/app/purchase-orders/[id]/page.tsx وsrc/app/batches/[id]/page.tsx قبل الاستخلاص ده.

/** نسبة الاستخلاص = الكمية المخرجة / الكمية المدخلة. */
export function computeYieldRate(quantityInput: unknown, quantityOutput: unknown): number | null {
  if (quantityOutput == null) return null;
  const input = Number(quantityInput);
  const output = Number(quantityOutput);
  if (!(input > 0)) return null;
  return output / input;
}

/** الهدر = الكمية المدخلة - الكمية المخرجة. */
export function computeWasteQuantity(quantityInput: unknown, quantityOutput: unknown): number | null {
  if (quantityOutput == null) return null;
  return Number(quantityInput) - Number(quantityOutput);
}

/** تكلفة الكيلو الصافي الفعلية = إجمالي التكلفة الفعلية / (الكمية المتاحة × نسبة الاستخلاص المتوقعة). */
export function computeEffectiveCostPerSaleableKg(totalEffectiveCost: unknown, availableQuantity: unknown, expectedYield: unknown): number | null {
  if (totalEffectiveCost == null || availableQuantity == null || expectedYield == null) return null;
  const saleable = Number(availableQuantity) * Number(expectedYield);
  if (!(saleable > 0)) return null;
  return Number(totalEffectiveCost) / saleable;
}
