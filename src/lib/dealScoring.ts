/**
 * درجة الصفقة ودرجة ثقة التكاليف — المواصفة الأصلية، مشروع ٢ §٢٥ و§٢٦.
 *
 * ## ليه البند ده رجع دلوقتي
 *
 * `DealScenario.dealScore` و`costConfidenceScore` كانوا في التصميم (`docs/ERD.md` §207)
 * و**اتشالوا عمدًا** في `docs/SCOPE-P2.md` §3، لسبب محترم: قاعدة المشروع «ممنوع تدّي درجة
 * موزونة بلا تبرير» (ERD §3) كانت بتمنع حسابهم قبل ما يبقى فيه كيان يخزّن تفصيل المكوّنات.
 *
 * الكيان ده (`ScoreSnapshot` بـ`componentsBreakdown`) **اتبنى فعلًا في ١٨ سبتمبر** —
 * يعني المانع اتشال، والبند فضل مقفول لأن التأجيل اتسجّل بلا تسجيل المانع نفسه.
 * (اتكشف في جرد `docs/SPEC-COVERAGE.md`، 1 أكتوبر.)
 *
 * ## القرار التصميمي الأهم: الدرجة بتعرف تغطيتها
 *
 * المواصفة بتطلب ٨ مكوّنات. **ستة بس منهم ليهم بيانات حقيقية في النظام دلوقتي**، واتنين
 * منهم كمان بيعتمدوا على بيانات تاريخية ممكن ما تكونش اتجمعت لسه (أداء مورّد، حاويات سابقة).
 *
 * الحل السهل والغلط: نحط قيمة محايدة (50) للمكوّن الناقص ونكمّل. ده بيخرّج رقم **بيبان
 * موثوق وهو مش كده** — وبالظبط النوع ده من الأرقام هو اللي القاعدة اتكتبت عشانه.
 *
 * الحل هنا: المكوّن اللي مفيش له بيانات **بيتشال من الوزن خالص**، والدرجة بترجع ومعاها
 * `coveragePct` = نسبة الأوزان اللي اتحسبت فعلًا. درجة 80 بتغطية 60% مش زي درجة 80
 * بتغطية 100% — والواجهة لازم تعرض الاتنين مع بعض.
 *
 * ## قاعدة حاكمة من المواصفة (§٢٥)
 *
 * > «Deal Score لا يلغي: Walk-Away، Compliance Block، Credit Block، Expired Rates،
 * > Missing Critical Costs.»
 *
 * يعني الدرجة دي **مؤشر مش إذن**. منع البيع تحت `walkAwayPrice` مفروض بـTrigger في
 * القاعدة ومالهوش أي علاقة بالدرجة دي — صفقة درجتها 95 لسه ممنوعة لو سعرها تحت الحد.
 */

/** قيم الثقة الرقمية — مطابقة لمواصفة §٢٦ حرفيًا، والـenum نفسه مسمّى بالأرقام دي. */
const CONFIDENCE_VALUE: Record<string, number> = {
  Contract100: 100,
  OfficialQuote90: 90,
  ExpiringQuote75: 75,
  HistoricalAvg60: 60,
  InternalEstimate40: 40,
  Assumption20: 20,
};

export type ScoredCostItem = { amount: { toString(): string } | number; confidenceLevel: string };

export type CostConfidenceResult = {
  /** `null` = مفيش بنود تكلفة أصلًا، مش صفر. */
  score: number | null;
  reason: string;
  /** نسبة التكاليف اللي مصدرها تقدير أو افتراض (ثقة ≤ 40) — المواصفة بتطلب تحذير لما تكبر. */
  estimatedSharePct: number;
};

/**
 * متوسط ثقة التكاليف **موزونًا بالمبلغ** — مش متوسط حسابي بسيط.
 *
 * السبب: بند نولون 50,000 دولار «افتراض غير مؤكد» وبند شهادة 200 دولار «عقد ساري» —
 * المتوسط البسيط بيدّي 60 (ثقة متوسطة)، والحقيقة إن 99.6% من فلوس الصفقة مبنية على
 * افتراض. الترجيح بالمبلغ هو اللي بيعكس المخاطرة الحقيقية.
 */
export function computeCostConfidenceScore(items: ScoredCostItem[]): CostConfidenceResult {
  if (items.length === 0) {
    return { score: null, reason: "مفيش بنود تكلفة مسجّلة — مفيش أساس لحساب ثقة.", estimatedSharePct: 0 };
  }

  let weightedSum = 0;
  let totalAmount = 0;
  let estimatedAmount = 0;
  for (const item of items) {
    const amount = Math.abs(Number(item.amount.toString()));
    const confidence = CONFIDENCE_VALUE[item.confidenceLevel];
    // درجة ثقة مش معروفة = بيانات مش متوقَّعة، بنتجاهل البند بدل ما نخمّن له قيمة.
    if (!Number.isFinite(amount) || confidence === undefined) continue;
    weightedSum += amount * confidence;
    totalAmount += amount;
    if (confidence <= 40) estimatedAmount += amount;
  }

  if (totalAmount === 0) {
    return { score: null, reason: "كل بنود التكلفة بمبلغ صفر — مفيش أساس للترجيح.", estimatedSharePct: 0 };
  }

  const score = Math.round(weightedSum / totalAmount);
  const estimatedSharePct = Math.round((estimatedAmount / totalAmount) * 100);
  const reason =
    estimatedSharePct >= 40
      ? `متوسط ثقة التكاليف موزونًا بالمبلغ = ${score}. ⚠️ ${estimatedSharePct}% من قيمة التكاليف مصدرها تقدير داخلي أو افتراض غير مؤكد.`
      : `متوسط ثقة التكاليف موزونًا بالمبلغ = ${score} (${estimatedSharePct}% منها تقديرية).`;

  return { score, reason, estimatedSharePct };
}

/** الأوزان الافتراضية — مواصفة §٢٥ حرفيًا. مجموعها 100. */
export const DEAL_SCORE_WEIGHTS = {
  profitability: 25,
  priceVsMarket: 15,
  customerPaymentRisk: 15,
  costConfidence: 10,
  productReadiness: 10,
  supplierReadiness: 10,
  logisticsContainer: 10,
  strategicValue: 5,
} as const;

export type DealScoreComponentKey = keyof typeof DEAL_SCORE_WEIGHTS;

export const DEAL_SCORE_COMPONENT_LABEL: Record<DealScoreComponentKey, string> = {
  profitability: "الربحية",
  priceVsMarket: "وضع السعر أمام السوق",
  customerPaymentRisk: "مخاطر العميل والدفع",
  costConfidence: "ثقة التكاليف",
  productReadiness: "جاهزية المنتج",
  supplierReadiness: "جاهزية المورّد",
  logisticsContainer: "اللوجستيات واستغلال الحاوية",
  strategicValue: "القيمة الاستراتيجية",
};

export type DealScoreInput = {
  /** هامش الربح المتوقّع % — من `DealScenario.expectedMarginPct`. */
  expectedMarginPct: number | null;
  /** نتيجة `computeCostConfidenceScore` للسيناريو ده. */
  costConfidence: CostConfidenceResult;
  /** حالة المنتج — `Verified` جاهز، `NeedsReview` ناقص، `Draft` مش جاهز. */
  productStatus: string | null;
  /** علامات حمراء **مفتوحة** على العميل (مش المقفولة) مع خطورتها. */
  openRedFlagSeverities: string[];
  /** شروط الدفع: نسبة المقدّم وأيام الائتمان — من السيناريو. */
  advanceRatePct: number | null;
  creditDays: number | null;
  /** `SupplierPerformance.overallScore` للمورّد المرتبط بالصفقة، لو فيه. */
  supplierOverallScore: number | null;
  /** نسبة استغلال الحاوية % — محسوبة من حاويات فعلية سابقة، `null` لو مفيش تاريخ. */
  containerUtilizationPct: number | null;
};

export type DealScoreComponent = {
  key: DealScoreComponentKey;
  label: string;
  weight: number;
  /** `null` = مفيش بيانات، المكوّن اتشال من الوزن. */
  score: number | null;
  reason: string;
};

export type DealScoreResult = {
  /** `null` = مفيش ولا مكوّن قابل للحساب. */
  totalScore: number | null;
  /** نسبة الأوزان اللي اتحسبت فعلًا — الدرجة مالهاش معنى من غير الرقم ده جنبها. */
  coveragePct: number;
  components: DealScoreComponent[];
};

/** تفسير الدرجة — مواصفة §٢٥. */
export function dealScoreBand(score: number): { label: string; tone: "good" | "watch" | "negotiate" | "risk" } {
  if (score >= 85) return { label: "صفقة قوية", tone: "good" };
  if (score >= 70) return { label: "مناسبة مع مراقبة", tone: "watch" };
  if (score >= 55) return { label: "تحتاج تفاوضًا أو إعادة تصميم", tone: "negotiate" };
  return { label: "مخاطرة مرتفعة أو ربح ضعيف", tone: "risk" };
}

/** خطورة العلامة الحمراء → خصم من درجة مخاطر العميل. */
const RED_FLAG_PENALTY: Record<string, number> = { Low: 10, Medium: 25, High: 45, Critical: 70 };

export function computeDealScore(
  input: DealScoreInput,
  weights: Record<DealScoreComponentKey, number> = DEAL_SCORE_WEIGHTS
): DealScoreResult {
  const components: DealScoreComponent[] = [];
  const add = (key: DealScoreComponentKey, score: number | null, reason: string) =>
    components.push({ key, label: DEAL_SCORE_COMPONENT_LABEL[key], weight: weights[key], score, reason });

  // ── الربحية ──────────────────────────────────────────────────────────────
  // هامش 25% أو أكتر = 100. هامش صفر = 0. سالب = 0 (مش رقم سالب يلخبط المتوسط).
  if (input.expectedMarginPct === null) {
    add("profitability", null, "مفيش هامش ربح محسوب للسيناريو ده لسه.");
  } else {
    const score = Math.max(0, Math.min(100, Math.round((input.expectedMarginPct / 25) * 100)));
    add("profitability", score, `هامش الربح المتوقّع ${input.expectedMarginPct}% (هامش 25% = الدرجة الكاملة).`);
  }

  // ── وضع السعر أمام السوق ─────────────────────────────────────────────────
  // ⚠️ مفيش كيان بيخزّن سعر سوق مرجعي في المنظومة دلوقتي. ممنوع نخمّنه.
  add("priceVsMarket", null, "مفيش سعر سوق مرجعي مسجّل في النظام — المكوّن ده محتاج مكتبة أسعار (بند مفتوح في docs/SPEC-COVERAGE.md).");

  // ── مخاطر العميل والدفع ──────────────────────────────────────────────────
  // ⚠️ **غياب العلامات الحمراء مش دليل نظافة** — ممكن يكون محدش فحص العميل أصلًا.
  // فالمكوّن ده محتاج أساس حقيقي: شروط دفع مسجّلة (بتقول إيه الانكشاف فعلًا) أو علامة
  // حمراء مسجّلة. من غير أي واحد منهم، إحنا مش عارفين حاجة → `null` مش 100.
  // (اتكشف باختبار «مفيش بيانات خالص» اللي طلّع درجة 100 بتغطية 15% — طمأنينة كاذبة.)
  if (input.openRedFlagSeverities.length === 0 && input.advanceRatePct === null && input.creditDays === null) {
    add("customerPaymentRisk", null, "مفيش شروط دفع مسجّلة ولا فحص علامات حمراء للعميل — مفيش أساس لتقييم المخاطرة.");
  } else {
    let score = 100;
    const notes: string[] = [];
    for (const severity of input.openRedFlagSeverities) {
      const penalty = RED_FLAG_PENALTY[severity] ?? 25;
      score -= penalty;
    }
    if (input.openRedFlagSeverities.length > 0) {
      notes.push(`${input.openRedFlagSeverities.length} علامة حمراء مفتوحة على العميل`);
    }
    // انكشاف ائتماني: مقدّم قليل + أيام ائتمان كتير = مخاطرة أعلى.
    if (input.advanceRatePct !== null) {
      if (input.advanceRatePct < 30) {
        score -= 15;
        notes.push(`مقدّم ${input.advanceRatePct}% بس`);
      }
    }
    if (input.creditDays !== null && input.creditDays > 60) {
      score -= 15;
      notes.push(`${input.creditDays} يوم ائتمان`);
    }
    score = Math.max(0, Math.min(100, score));
    add("customerPaymentRisk", score, notes.length > 0 ? `خصم بسبب: ${notes.join("، ")}.` : "مفيش علامات حمراء مفتوحة ولا انكشاف ائتماني مرتفع.");
  }

  // ── ثقة التكاليف ─────────────────────────────────────────────────────────
  add("costConfidence", input.costConfidence.score, input.costConfidence.reason);

  // ── جاهزية المنتج ────────────────────────────────────────────────────────
  {
    const map: Record<string, { score: number; note: string }> = {
      Verified: { score: 100, note: "بيانات المنتج متحقَّق منها." },
      NeedsReview: { score: 50, note: "بيانات المنتج محتاجة مراجعة." },
      Draft: { score: 20, note: "المنتج لسه مسودة." },
    };
    const hit = input.productStatus ? map[input.productStatus] : undefined;
    if (hit) add("productReadiness", hit.score, hit.note);
    else add("productReadiness", null, "حالة المنتج مش معروفة.");
  }

  // ── جاهزية المورّد ───────────────────────────────────────────────────────
  if (input.supplierOverallScore === null) {
    add("supplierReadiness", null, "مفيش تقييم أداء مسجّل لمورّد مرتبط بالصفقة دي.");
  } else {
    const score = Math.max(0, Math.min(100, Math.round(input.supplierOverallScore)));
    add("supplierReadiness", score, `تقييم أداء المورّد المسجّل = ${score}.`);
  }

  // ── اللوجستيات واستغلال الحاوية ──────────────────────────────────────────
  if (input.containerUtilizationPct === null) {
    add("logisticsContainer", null, "مفيش حاويات سابقة كفاية لحساب استغلال حقيقي — الرقم بيتحسب من شحنات فعلية مش من سعة قياسية مفترضة.");
  } else {
    const score = Math.max(0, Math.min(100, Math.round(input.containerUtilizationPct)));
    add("logisticsContainer", score, `استغلال الحاوية المتوقّع ${score}% (محسوب من حاويات فعلية سابقة).`);
  }

  // ── القيمة الاستراتيجية ──────────────────────────────────────────────────
  add("strategicValue", null, "تقدير إداري — مفيش حقل إدخال له لسه.");

  // ── التجميع ──────────────────────────────────────────────────────────────
  const available = components.filter((c) => c.score !== null);
  const availableWeight = available.reduce((sum, c) => sum + c.weight, 0);
  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
  const coveragePct = totalWeight === 0 ? 0 : Math.round((availableWeight / totalWeight) * 100);

  if (availableWeight === 0) return { totalScore: null, coveragePct: 0, components };

  const weighted = available.reduce((sum, c) => sum + (c.score as number) * c.weight, 0);
  return { totalScore: Math.round(weighted / availableWeight), coveragePct, components };
}
