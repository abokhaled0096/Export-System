/**
 * حساب النتائج الفعلية ومقارنتها بالمخطط — مواصفة مشروع ٢ §٢٧.
 *
 * ## ليه دالة نقية ومش أعمدة مخزَّنة
 *
 * المواصفة بتطلب ١٣ مخرج محسوب (Actual Full Cost، Actual Profit، Cost Variance،
 * Actual Cash Cycle، دقة التسعير...). لو اتخزّنوا كأعمدة:
 *   • أي تعديل في معادلة = migration + إعادة حساب لكل الصفوف القديمة.
 *   • وفي الفترة دي بيبقى فيه صفوف محسوبة بمعادلة قديمة وصفوف بالجديدة — وده
 *     بالظبط نوع التناقض اللي بيخلّي حد يفقد الثقة في الأرقام كلها.
 *
 * دلوقتي: الجدول فيه **المدخلات الخام بس**، والحساب هنا. تعديل أي معادلة = تعديل
 * دالة واحدة + اختباراتها، والأرقام القديمة بتتحسب بالمعادلة الجديدة فورًا.
 *
 * نفس نمط `variance` في `CashFlowForecastLine` و`chargeDays` في `FreeTimeRecord`.
 *
 * ## القاعدة المتكررة في المشروع
 *
 * ناقص بيانة = `null`، **مش صفر**. ربح فعلي `null` معناه «مش متسجّل»، وربح صفر
 * معناه «اتسجّل وطلع صفر». الفرق ده بيغيّر قرار إداري.
 */

type Num = { toString(): string } | number | null | undefined;

function n(v: Num): number | null {
  if (v === null || v === undefined || v === "") return null;
  const x = typeof v === "number" ? v : Number(v.toString());
  return Number.isFinite(x) ? x : null;
}

/** مجموع القيم المتاحة، و`null` لو مفيش ولا واحدة (مش صفر). */
function sumAvailable(values: (number | null)[]): number | null {
  const present = values.filter((v): v is number => v !== null);
  return present.length === 0 ? null : present.reduce((a, b) => a + b, 0);
}

export type DealActualInput = {
  actualQuantityRaw: Num;
  actualQuantitySaleable: Num;
  actualWasteQuantity: Num;
  actualPurchasePrice: Num;
  actualProcessingCost: Num;
  actualPackagingCost: Num;
  actualInlandTransport: Num;
  actualPortCharges: Num;
  actualFreight: Num;
  actualBankCharges: Num;
  actualFinanceCost: Num;
  penalties: Num;
  claims: Num;
  postSaleDeductions: Num;
  fxDifference: Num;
  unexpectedCosts: Num;
  amountCollected: Num;
  collectedAt: Date | null;
};

export type PlannedInput = {
  quantityRaw: Num;
  quantitySaleable: Num;
  expectedProfit: Num;
  expectedMarginPct: Num;
  finalPrice: Num;
  /** تاريخ إقفال الصفقة — أساس حساب تأخير التحصيل ودورة النقد. */
  closedAt: Date | null;
};

export type DealActualResult = {
  /** إجمالي التكلفة الفعلية — كل بنود التكلفة المسجّلة. */
  actualFullCost: number | null;
  /** تكلفة الكيلو الفعلية (على الكمية **القابلة للبيع** مش الخام). */
  actualCostPerKg: number | null;
  /** العائد الفعلي % = القابل للبيع ÷ الخام. */
  actualYieldPct: number | null;
  actualProfit: number | null;
  actualMarginPct: number | null;
  actualMarkupPct: number | null;
  /** أيام من إقفال الصفقة للتحصيل. */
  actualCashCycleDays: number | null;
  /** فرق التكلفة عن المخطط (موجب = زيادة تكلفة). */
  costVariance: number | null;
  profitVariance: number | null;
  marginVariancePct: number | null;
  /** دقة التسعير % — قد إيه الربح الفعلي قرّب من المخطط. 100 = مطابق. */
  pricingAccuracyPct: number | null;
  /** تحذيرات على البيانات نفسها (مش على النتيجة). */
  warnings: string[];
};

export function computeDealActual(actual: DealActualInput, planned: PlannedInput): DealActualResult {
  const warnings: string[] = [];

  const qtyRaw = n(actual.actualQuantityRaw);
  const qtySaleable = n(actual.actualQuantitySaleable);
  const purchasePrice = n(actual.actualPurchasePrice);

  // تكلفة الشراء = سعر الوحدة × الكمية الخام (الشراء بيتم على الخام مش القابل للبيع).
  const purchaseCost = purchasePrice !== null && qtyRaw !== null ? purchasePrice * qtyRaw : null;

  const costParts = [
    purchaseCost,
    n(actual.actualProcessingCost),
    n(actual.actualPackagingCost),
    n(actual.actualInlandTransport),
    n(actual.actualPortCharges),
    n(actual.actualFreight),
    n(actual.actualBankCharges),
    n(actual.actualFinanceCost),
    n(actual.penalties),
    n(actual.claims),
    n(actual.postSaleDeductions),
    n(actual.unexpectedCosts),
  ];
  const baseCost = sumAvailable(costParts);

  // ⚠️ فرق العملة بيتجمع بإشارته: خسارة صرف بتزوّد التكلفة، ومكسب بيقلّلها.
  // مابنحطهوش في `sumAvailable` مع الباقي عشان الإشارة تفضل واضحة في القراءة.
  const fx = n(actual.fxDifference);
  const actualFullCost = baseCost === null ? (fx ?? null) : baseCost + (fx ?? 0);

  if (purchasePrice !== null && qtyRaw === null) {
    warnings.push("سعر الشراء متسجّل بلا كمية خام — تكلفة الشراء مش داخلة في الإجمالي.");
  }

  const actualCostPerKg = actualFullCost !== null && qtySaleable !== null && qtySaleable > 0 ? actualFullCost / qtySaleable : null;
  const actualYieldPct = qtyRaw !== null && qtySaleable !== null && qtyRaw > 0 ? (qtySaleable / qtyRaw) * 100 : null;

  const collected = n(actual.amountCollected);
  const actualProfit = collected !== null && actualFullCost !== null ? collected - actualFullCost : null;
  const actualMarginPct = actualProfit !== null && collected !== null && collected > 0 ? (actualProfit / collected) * 100 : null;
  const actualMarkupPct = actualProfit !== null && actualFullCost !== null && actualFullCost > 0 ? (actualProfit / actualFullCost) * 100 : null;

  // دورة النقد = من إقفال الصفقة للتحصيل.
  let actualCashCycleDays: number | null = null;
  if (planned.closedAt && actual.collectedAt) {
    actualCashCycleDays = Math.round((actual.collectedAt.getTime() - planned.closedAt.getTime()) / 86_400_000);
    if (actualCashCycleDays < 0) {
      warnings.push("تاريخ التحصيل قبل تاريخ إقفال الصفقة — راجع التواريخ.");
    }
  }

  // ── الانحرافات عن المخطط ─────────────────────────────────────────────────
  const plannedProfit = n(planned.expectedProfit);
  const plannedMargin = n(planned.expectedMarginPct);
  const plannedPrice = n(planned.finalPrice);
  const plannedQtySaleable = n(planned.quantitySaleable);

  // التكلفة المخططة مش عمود مباشر — بتتشتق: (السعر × الكمية) − الربح المتوقّع.
  const plannedRevenue = plannedPrice !== null && plannedQtySaleable !== null ? plannedPrice * plannedQtySaleable : null;
  const plannedCost = plannedRevenue !== null && plannedProfit !== null ? plannedRevenue - plannedProfit : null;

  const costVariance = actualFullCost !== null && plannedCost !== null ? actualFullCost - plannedCost : null;
  const profitVariance = actualProfit !== null && plannedProfit !== null ? actualProfit - plannedProfit : null;
  const marginVariancePct = actualMarginPct !== null && plannedMargin !== null ? actualMarginPct - plannedMargin : null;

  // دقة التسعير: 100% لو الربح الفعلي = المخطط، وبتقل كل ما الفرق يكبر.
  // ⚠️ ربح مخطط صفر أو سالب مالوش نسبة معنى — بنرجّع null مش رقم مخترع.
  let pricingAccuracyPct: number | null = null;
  if (actualProfit !== null && plannedProfit !== null && plannedProfit > 0) {
    pricingAccuracyPct = Math.max(0, 100 - (Math.abs(actualProfit - plannedProfit) / plannedProfit) * 100);
  }

  const round = (v: number | null, d = 2) => (v === null ? null : Math.round(v * 10 ** d) / 10 ** d);

  return {
    actualFullCost: round(actualFullCost),
    actualCostPerKg: round(actualCostPerKg, 4),
    actualYieldPct: round(actualYieldPct),
    actualProfit: round(actualProfit),
    actualMarginPct: round(actualMarginPct),
    actualMarkupPct: round(actualMarkupPct),
    actualCashCycleDays,
    costVariance: round(costVariance),
    profitVariance: round(profitVariance),
    marginVariancePct: round(marginVariancePct),
    pricingAccuracyPct: round(pricingAccuracyPct),
    warnings,
  };
}

/** أسباب الانحراف — مواصفة §٢٧ «تصنيف أسباب الانحراف» حرفيًا (١٥ سبب). */
export const DEVIATION_REASON_LABEL: Record<string, string> = {
  Supplier: "المورّد",
  Quality: "الجودة",
  Waste: "الفاقد",
  Processing: "التشغيل",
  Packaging: "التعبئة",
  InlandTransport: "النقل",
  Freight: "الشحن",
  Port: "الميناء",
  Bank: "البنك",
  Currency: "العملة",
  Customer: "العميل",
  Delay: "التأخير",
  Compliance: "الامتثال",
  DataEntryError: "خطأ إدخال",
  HiddenCost: "تكلفة مخفية",
};

/**
 * الفرق لما يتعدّى الحد ده لازم يبقى معاه سبب انحراف مسجَّل.
 *
 * ⚠️ ده **مش قيد قاعدة بيانات** عن قصد: تسجيل النتيجة الفعلية بيحصل على مراحل
 * (التكاليف الأول، التحصيل بعدين)، فمنع الحفظ لحد ما السبب يتسجّل هيمنع التسجيل
 * الجزئي أصلًا. بدل كده الواجهة بتطالب بالسبب بوضوح، والنتيجة بتتعلّم «ناقصة سبب».
 */
export const MATERIAL_VARIANCE_PCT = 10;

/** هل الانحراف ده جوهري ومحتاج تفسير؟ */
export function needsDeviationExplanation(result: DealActualResult, plannedProfitValue: number | null): boolean {
  if (result.profitVariance === null || plannedProfitValue === null || plannedProfitValue === 0) return false;
  return Math.abs(result.profitVariance / plannedProfitValue) * 100 > MATERIAL_VARIANCE_PCT;
}
