import { Prisma } from "@/generated/prisma/client";

export type DepreciableAsset = {
  purchaseValue: Prisma.Decimal;
  usefulLifeMonths: number;
  accumulatedDepreciation: Prisma.Decimal;
  depreciationMethod: string;
  /** عدد الفترات (الشهور) اللي إهلاك اتترحّل لها بالفعل لحد دلوقتي — مطلوب بس لـ
   * DecliningBalance (راجع تعليقها تحت لسبب الحاجة ليه). مش مطلوب لـStraightLine. */
  periodsElapsed?: number;
};

/**
 * القسط الشهري بطريقة القسط الثابت — `purchaseValue / usefulLifeMonths`، مقفول عند القيمة
 * المتبقية عشان القيمة الدفترية الصافية متنزلش تحت الصفر (الشهر الأخير غالبًا هيكون قسط أصغر
 * بسبب تقريب الشهور السابقة). دالة حساب بحتة بلا أي I/O — قابلة للاختبار المباشر.
 */
function computeStraightLineDepreciation(asset: DepreciableAsset): Prisma.Decimal {
  const remaining = asset.purchaseValue.sub(asset.accumulatedDepreciation);
  if (remaining.lte(0)) return new Prisma.Decimal(0);

  const monthly = asset.purchaseValue.div(asset.usefulLifeMonths);
  return monthly.gt(remaining) ? remaining : monthly;
}

/**
 * القسط الشهري بطريقة الرصيد المتناقص المضاعف (Double Declining Balance) — النسبة الشهرية =
 * 2 ÷ usefulLifeMonths، مطبَّقة على صافي القيمة الدفترية الحالي، بلا قيمة متبقية (Salvage
 * Value) لأن الـschema مفيهوش عمود لها أصلًا (نفس افتراض القسط الثابت).
 *
 * ⚠️ الرصيد المتناقص الصِرف رياضيًا **مايوصلش للصفر أبدًا** خلال العمر الإنتاجي — كل شهر بياخد
 * نسبة من الباقي، فدايمًا فاضل باقي أصغر وأصغر (اتأكد بحساب فعلي: أصل 24,000 على 24 شهر لسه
 * فاضله ~2,974 بعد 24 شهر كاملة). الحل المعياري المتّبع في كل نظم المحاسبة الحقيقية (وده
 * السبب في `periodsElapsed`): "التحويل للقسط الثابت" (Switch to Straight-Line) — كل شهر
 * بيتقارن قسط الرصيد المتناقص بقسط القسط الثابت المحسوب على **الباقي من العمر الإنتاجي**
 * (`usefulLifeMonths - periodsElapsed`)، وياخد الأكبر. النتيجة: الأصل بيتحول تلقائيًا للقسط
 * الثابت في الشهور الأخيرة (لما القسط الثابت-على-الباقي يبقى أكبر من نسبة الرصيد المتناقص)،
 * فبيتقفل صفر بالظبط بنهاية العمر الإنتاجي — مش اختراع، ده التعريف الكامل المعياري للطريقة في
 * أي مرجع محاسبي (مثال: MACRS الأمريكي بيستخدم نفس المنطق بالحرف).
 */
function computeDecliningBalanceDepreciation(asset: DepreciableAsset): Prisma.Decimal {
  const netBookValue = asset.purchaseValue.sub(asset.accumulatedDepreciation);
  if (netBookValue.lte(0)) return new Prisma.Decimal(0);

  const remainingMonths = asset.usefulLifeMonths - (asset.periodsElapsed ?? 0);
  if (remainingMonths <= 0) return netBookValue; // العمر الإنتاجي خلص لكن لسه فيه رصيد — يتقفل هنا.

  const decliningAmount = netBookValue.mul(new Prisma.Decimal(2).div(asset.usefulLifeMonths));
  const straightLineOnRemaining = netBookValue.div(remainingMonths);
  const monthly = decliningAmount.gt(straightLineOnRemaining) ? decliningAmount : straightLineOnRemaining;

  return monthly.gt(netBookValue) ? netBookValue : monthly;
}

/** موزّع الطريقتين المدعومتين — بند BACKLOG.md § وحدة 8 ("DecliningBalance كطريقة إهلاك مش
 * مُنفَّذة") اتحل بإضافة الرصيد المتناقص المضاعف (بالتحويل للقسط الثابت) جنب القسط الثابت،
 * نفس نمط Loan.amortizationMethod (طريقتان صريحتان بدل طريقة واحدة مفروضة). */
export function computeDepreciation(asset: DepreciableAsset): Prisma.Decimal {
  if (asset.depreciationMethod === "DecliningBalance") return computeDecliningBalanceDepreciation(asset);
  if (asset.depreciationMethod === "StraightLine") return computeStraightLineDepreciation(asset);
  throw new Error(`طريقة الإهلاك "${asset.depreciationMethod}" غير معروفة.`);
}
