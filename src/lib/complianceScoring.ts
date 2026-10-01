/**
 * مؤشر جاهزية الامتثال ودرجة المخاطرة — المواصفة الأصلية، مشروع ٥ §٢٤ و§٢٦.
 *
 * ## ليه البند ده رجع دلوقتي
 *
 * `ComplianceCase.readinessScore`/`riskScore` **اتشالوا عمدًا** في `docs/SCOPE-P5.md` §1،
 * بنفس قرار `DealScenario.dealScore` — قاعدة «ممنوع تدّي درجة موزونة بلا تبرير» كانت
 * بتمنع حسابهم قبل ما يبقى فيه كيان يخزّن تفصيل المكوّنات. `ScoreSnapshot` اتبنى
 * ١٨ سبتمبر والمانع اتشال. (جرد `docs/SPEC-COVERAGE.md`، 1 أكتوبر.)
 *
 * ## نفس فلسفة `dealScoring.ts`
 *
 * المكوّن اللي مفيش له بيانات **بيتشال من الوزن**، مش بياخد قيمة محايدة. والنتيجة
 * بترجع ومعاها `coveragePct`. راجع `src/lib/dealScoring.ts` للتفصيل الكامل للسبب.
 *
 * ## ⚠️ قاعدة حاكمة من المواصفة (§٢٤)
 *
 * > «لا يمكن أن تعوّض الدرجة: منتج محظور، شهادة إلزامية منتهية، HS Code متنازع عليه
 * > بصورة حرجة، نتيجة تحليل Fail، منشأة غير معتمدة، قواعد منشأ غير مستوفاة عند
 * > المطالبة بإعفاء، مستند LC حرج ناقص، أمر Block رسمي.»
 *
 * عشان كده الدالة بترجع `blockers[]` **منفصلة تمامًا عن الدرجة**. ملف جاهزيته 95
 * ومعاه حاجز واحد = **مش جاهز**، والواجهة لازم تعرض الحواجز فوق الرقم مش تحته.
 * الدرجة بتوصف التقدّم، الحواجز بتحدّد الإذن — ودول حاجتين مختلفتين.
 */

/** الأوزان الافتراضية — مواصفة §٢٤ حرفيًا. مجموعها 100. */
export const READINESS_WEIGHTS = {
  productLegality: 15,
  hsClassification: 10,
  marketRequirements: 15,
  supplierFacilityEligibility: 10,
  certificates: 10,
  testingQuality: 10,
  packagingLabel: 10,
  documents: 10,
  originCustoms: 5,
  shipmentReadiness: 5,
} as const;

export type ReadinessComponentKey = keyof typeof READINESS_WEIGHTS;

export const READINESS_COMPONENT_LABEL: Record<ReadinessComponentKey, string> = {
  productLegality: "مشروعية المنتج",
  hsClassification: "التصنيف الجمركي",
  marketRequirements: "متطلبات السوق",
  supplierFacilityEligibility: "أهلية المورّد والمنشأة",
  certificates: "الشهادات",
  testingQuality: "الفحص والجودة",
  packagingLabel: "التعبئة والملصق",
  documents: "المستندات",
  originCustoms: "المنشأ والجمارك",
  shipmentReadiness: "جاهزية الشحنة",
};

export type ReadinessInput = {
  /** حالات المتطلبات المسجّلة على الملف. */
  requirementStatuses: string[];
  /** حالات البوابات. */
  gateStatuses: string[];
  /** تصنيفات HS للمنتج×السوق — العدد والحالة. */
  hsClassificationStatuses: string[];
  /** الشهادات المرتبطة: الحالة + تاريخ الانتهاء + إلزامية؟ */
  certificates: { status: string; expiryDate: Date | null }[];
  /** تسجيلات المنشأة/المورّد. */
  registrationStatuses: string[];
  /** إثباتات المنشأ. */
  originProofStatuses: string[];
  /** شحنات مرتبطة بالملف. */
  shipmentCount: number;
  /** حالات الرفض المفتوحة (أمر Block رسمي أو رفض سابق). */
  openRejectionCount: number;
  /** مواصفة منتج معتمدة فيها تعبئة وملصق؟ `null` = مفيش مواصفة أصلًا. */
  hasApprovedPackagingSpec: boolean | null;
  /** نتائج الفحوص المعملية للدفعات المرتبطة — `null` = مفيش فحوص مسجّلة. */
  labTestResults: string[] | null;
  /** المنتج محظور في السوق ده؟ `null` = مش متقيَّم. */
  productBanned: boolean | null;
};

export type ReadinessComponent = {
  key: ReadinessComponentKey;
  label: string;
  weight: number;
  score: number | null;
  reason: string;
};

export type ReadinessResult = {
  totalScore: number | null;
  coveragePct: number;
  components: ReadinessComponent[];
  /** ⚠️ حواجز مطلقة — الدرجة مابتعوّضهاش (مواصفة §٢٤). */
  blockers: string[];
};

/** تصنيف الجاهزية — مواصفة §٢٤. */
export function readinessBand(score: number): { label: string; tone: "ready" | "minor" | "actions" | "notReady" | "blocked" } {
  if (score >= 90) return { label: "جاهز", tone: "ready" };
  if (score >= 75) return { label: "جاهز بشروط بسيطة", tone: "minor" };
  if (score >= 60) return { label: "يحتاج إجراءات مهمة", tone: "actions" };
  if (score >= 40) return { label: "غير جاهز", tone: "notReady" };
  return { label: "موقوف أو عالي المخاطر", tone: "blocked" };
}

/** نسبة مئوية من عدّادين، أو `null` لو مفيش عناصر أصلًا. */
function ratio(met: number, total: number): number | null {
  return total === 0 ? null : Math.round((met / total) * 100);
}

export function computeReadinessScore(
  input: ReadinessInput,
  weights: Record<ReadinessComponentKey, number> = READINESS_WEIGHTS
): ReadinessResult {
  const components: ReadinessComponent[] = [];
  const blockers: string[] = [];
  const add = (key: ReadinessComponentKey, score: number | null, reason: string) =>
    components.push({ key, label: READINESS_COMPONENT_LABEL[key], weight: weights[key], score, reason });

  // ── مشروعية المنتج ───────────────────────────────────────────────────────
  if (input.productBanned === null) {
    add("productLegality", null, "مشروعية المنتج في السوق ده مش متقيَّمة — سجّل متطلب من فئة «حظر/قيود» لو فيه.");
  } else if (input.productBanned) {
    add("productLegality", 0, "⚠️ المنتج محظور في السوق ده.");
    blockers.push("منتج محظور في السوق المستهدف");
  } else {
    add("productLegality", 100, "مفيش حظر مسجّل على المنتج في السوق ده.");
  }

  // ── التصنيف الجمركي ──────────────────────────────────────────────────────
  if (input.hsClassificationStatuses.length === 0) {
    add("hsClassification", null, "مفيش تصنيف جمركي مسجّل للمنتج في السوق ده.");
  } else {
    // ⚠️ مفيش قيمة اسمها "Confirmed" في الـenum — فيه تلاتة: ConfirmedInternally /
    // ConfirmedByBroker / ConfirmedByRuling. المطابقة على "Confirmed" وحدها كانت هتدّي
    // صفر دايمًا حتى لو التصنيف مؤكَّد. (اتكشف بمطابقة الكود على الـenum الفعلي.)
    const CONFIRMED = ["ConfirmedInternally", "ConfirmedByBroker", "ConfirmedByRuling"];
    const disputed = input.hsClassificationStatuses.filter((s) => s === "Disputed").length;
    const confirmed = input.hsClassificationStatuses.filter((s) => CONFIRMED.includes(s)).length;
    if (disputed > 0) blockers.push(`${disputed} تصنيف جمركي متنازع عليه`);
    const score = ratio(confirmed, input.hsClassificationStatuses.length) ?? 0;
    add("hsClassification", score, `${confirmed} من ${input.hsClassificationStatuses.length} تصنيف مؤكَّد${disputed > 0 ? `، و${disputed} متنازع عليه` : ""}.`);
  }

  // ── متطلبات السوق ────────────────────────────────────────────────────────
  {
    // المتطلبات اللي «مش منطبقة» بتتشال من المقام — مش منطقي تتحسب ناقصة.
    const relevant = input.requirementStatuses.filter((s) => s !== "NotApplicable");
    const met = relevant.filter((s) => s === "Met").length;
    const partial = relevant.filter((s) => s === "PartiallyMet").length;
    const blocking = relevant.filter((s) => s === "Blocking").length;
    if (blocking > 0) blockers.push(`${blocking} متطلب حاجب (Blocking)`);
    if (relevant.length === 0) {
      add("marketRequirements", null, "مفيش متطلبات منطبقة مسجّلة على الملف ده.");
    } else {
      // المستوفى جزئيًا بنصف درجة — تقدّم حقيقي بس مش اكتمال.
      const score = Math.round(((met + partial * 0.5) / relevant.length) * 100);
      add("marketRequirements", score, `${met} مستوفى و${partial} مستوفى جزئيًا من ${relevant.length} متطلب منطبق${blocking > 0 ? `، و${blocking} حاجب` : ""}.`);
    }
  }

  // ── أهلية المورّد والمنشأة ───────────────────────────────────────────────
  if (input.registrationStatuses.length === 0) {
    add("supplierFacilityEligibility", null, "مفيش تسجيلات منشأة/مورّد مسجّلة للمنتج ده.");
  } else {
    const approved = input.registrationStatuses.filter((s) => s === "Approved").length;
    const score = ratio(approved, input.registrationStatuses.length) ?? 0;
    if (approved === 0) blockers.push("مفيش منشأة معتمدة واحدة");
    add("supplierFacilityEligibility", score, `${approved} من ${input.registrationStatuses.length} تسجيل معتمد.`);
  }

  // ── الشهادات ─────────────────────────────────────────────────────────────
  if (input.certificates.length === 0) {
    add("certificates", null, "مفيش شهادات مسجّلة للمنتج أو العميل.");
  } else {
    const now = new Date();
    // ExpiringSoon لسه سارية فعليًا — بتتحسب صالحة، والتنبيه عليها شغل شاشة الشهادات مش الدرجة.
    const expired = input.certificates.filter((c) => c.status === "Expired" || c.status === "Suspended" || (c.expiryDate !== null && c.expiryDate < now));
    const valid = input.certificates.filter(
      (c) => (c.status === "Valid" || c.status === "ExpiringSoon") && (c.expiryDate === null || c.expiryDate >= now)
    );
    if (expired.length > 0) blockers.push(`${expired.length} شهادة منتهية`);
    const score = ratio(valid.length, input.certificates.length) ?? 0;
    add("certificates", score, `${valid.length} سارية من ${input.certificates.length}${expired.length > 0 ? `، و${expired.length} منتهية` : ""}.`);
  }

  // ── الفحص والجودة ────────────────────────────────────────────────────────
  if (input.labTestResults === null || input.labTestResults.length === 0) {
    add("testingQuality", null, "مفيش فحوص معملية مرتبطة بالملف ده.");
  } else {
    const failed = input.labTestResults.filter((r) => r === "Fail").length;
    if (failed > 0) blockers.push(`${failed} فحص معملي نتيجته Fail`);
    const passed = input.labTestResults.length - failed;
    const score = ratio(passed, input.labTestResults.length) ?? 0;
    add("testingQuality", score, `${passed} ناجح من ${input.labTestResults.length}${failed > 0 ? `، و${failed} فاشل` : ""}.`);
  }

  // ── التعبئة والملصق ──────────────────────────────────────────────────────
  if (input.hasApprovedPackagingSpec === null) {
    add("packagingLabel", null, "مفيش مواصفة منتج مسجّلة لتقييم التعبئة والملصق.");
  } else {
    add("packagingLabel", input.hasApprovedPackagingSpec ? 100 : 40, input.hasApprovedPackagingSpec ? "فيه مواصفة معتمدة." : "المواصفة موجودة بس لسه مش معتمدة.");
  }

  // ── المستندات ────────────────────────────────────────────────────────────
  // ⚠️ مربوط بـDocument Completeness Score (§٢٥) اللي لسه متبنيش — بند في SPEC-COVERAGE.
  add("documents", null, "اكتمال المستندات محتاج محرك Document Completeness Score (بند مفتوح في docs/SPEC-COVERAGE.md).");

  // ── المنشأ والجمارك ──────────────────────────────────────────────────────
  if (input.originProofStatuses.length === 0) {
    add("originCustoms", null, "مفيش إثبات منشأ مسجّل للصفقة دي.");
  } else {
    const verified = input.originProofStatuses.filter((s) => s === "Verified" || s === "Issued").length;
    const score = ratio(verified, input.originProofStatuses.length) ?? 0;
    add("originCustoms", score, `${verified} من ${input.originProofStatuses.length} إثبات منشأ صادر/متحقَّق منه.`);
  }

  // ── جاهزية الشحنة ────────────────────────────────────────────────────────
  if (input.shipmentCount === 0) {
    add("shipmentReadiness", null, "مفيش شحنة مرتبطة بالملف ده لسه.");
  } else {
    const passedGates = input.gateStatuses.filter((s) => s === "Passed" || s === "PassedWithConditions" || s === "NotApplicable").length;
    const failed = input.gateStatuses.filter((s) => s === "Failed").length;
    if (failed > 0) blockers.push(`${failed} بوابة امتثال فاشلة`);
    const score = input.gateStatuses.length === 0 ? 50 : Math.round((passedGates / input.gateStatuses.length) * 100);
    add("shipmentReadiness", score, input.gateStatuses.length === 0 ? "فيه شحنة بس مفيش بوابات مسجّلة." : `${passedGates} بوابة عدّت من ${input.gateStatuses.length}.`);
  }

  // أمر رفض/حظر رسمي مفتوح = حاجز مطلق مهما كانت الدرجة.
  if (input.openRejectionCount > 0) blockers.push(`${input.openRejectionCount} حالة رفض مفتوحة`);

  const available = components.filter((c) => c.score !== null);
  const availableWeight = available.reduce((sum, c) => sum + c.weight, 0);
  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
  const coveragePct = totalWeight === 0 ? 0 : Math.round((availableWeight / totalWeight) * 100);

  if (availableWeight === 0) return { totalScore: null, coveragePct: 0, components, blockers };

  const weighted = available.reduce((sum, c) => sum + (c.score as number) * c.weight, 0);
  return { totalScore: Math.round(weighted / availableWeight), coveragePct, components, blockers };
}
