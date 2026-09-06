import { Prisma } from "@/generated/prisma/client";

export type DepreciableAsset = {
  purchaseValue: Prisma.Decimal;
  usefulLifeMonths: number;
  accumulatedDepreciation: Prisma.Decimal;
  depreciationMethod: string;
};

/**
 * القسط الشهري بطريقة القسط الثابت — `purchaseValue / usefulLifeMonths`، مقفول عند القيمة
 * المتبقية عشان القيمة الدفترية الصافية متنزلش تحت الصفر (الشهر الأخير غالبًا هيكون قسط أصغر
 * بسبب تقريب الشهور السابقة). دالة حساب بحتة بلا أي I/O — قابلة للاختبار المباشر.
 *
 * `DecliningBalance` مش مُنفَّذة لسه (مسجَّلة في BACKLOG.md) — الدالة بترمي خطأ واضح بدل
 * ما ترجع رقم غلط بصمت.
 */
export function computeStraightLineDepreciation(asset: DepreciableAsset): Prisma.Decimal {
  if (asset.depreciationMethod !== "StraightLine") {
    throw new Error(`طريقة الإهلاك "${asset.depreciationMethod}" مش متاحة لسه — القسط الثابت بس المدعوم دلوقتي.`);
  }

  const remaining = asset.purchaseValue.sub(asset.accumulatedDepreciation);
  if (remaining.lte(0)) return new Prisma.Decimal(0);

  const monthly = asset.purchaseValue.div(asset.usefulLifeMonths);
  return monthly.gt(remaining) ? remaining : monthly;
}
