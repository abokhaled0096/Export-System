/**
 * حالة أتمتة العمولة — **تعريف واحد** مشترك بين المحرك (`accrueCommissionOnCollection`)
 * والشاشات اللي بتعرض الحالة للمستخدم.
 *
 * ## ليه ده موجود
 *
 * المحرك بيسجّل العمولة تلقائيًا عند التحصيل **بس لو فيه خطة مؤهّلة واحدة بالظبط** —
 * لأن مفيش ربط في الـschema بين الخطة والموظف أو الصفقة، فلو فيه خطتين مفيش طريقة
 * مضمونة نعرف أنهي واحدة تتطبّق. القرار ده صح: ممنوع التخمين في مسار فلوس.
 *
 * **المشكلة كانت الصمت، مش القرار.** اتكشف بتجربة دورة عمولة كاملة (1 أكتوبر): ضفت
 * خطة تانية مؤهّلة، وخصّصت دفعة 20,000 — التخصيص عدّى عادي، والشاشة قالت «تم»،
 * و**مفيش عمولة اتسجّلت ولا تحذير ظهر**. المحاسب مش هيعرف إن عمولة المندوب ضاعت
 * إلا لما المندوب يشتكي، وساعتها يبقى عدّى شهر.
 *
 * نفس فئة عيب «نتيجة معملية بره الحد متسجّلة ناجح» — القاعدة سليمة، لكن نتيجتها
 * كانت بتحصل في الخفا.
 */

export type CommissionPlanLike = {
  name: string;
  basis: string;
  triggerEvent: string;
  ratePct?: { toString(): string } | number | null;
};

export type CommissionAutomationState =
  /** خطة واحدة مؤهّلة — الأتمتة شغّالة. */
  | { status: "Active"; planName: string; ratePct: string }
  /** مفيش خطة مؤهّلة — كل عمولة لازم تتسجّل بالإيد. */
  | { status: "NoPlan" }
  /** أكتر من خطة مؤهّلة — الأتمتة متوقّفة عشان مفيش طريقة نعرف أنهي خطة تتطبّق. */
  | { status: "Ambiguous"; planNames: string[] }
  /** خطة واحدة بس نسبتها فاضية أو صفر — شكلها مضبوطة وهي مش هتعمل حاجة. */
  | { status: "InvalidRate"; planName: string };

/** الخطط اللي المحرك بيعتبرها مؤهّلة — لازم تطابق الفلتر في `accrueCommissionOnCollection`. */
export function eligiblePlansForAutoAccrual<T extends CommissionPlanLike>(plans: T[]): T[] {
  return plans.filter((p) => p.triggerEvent === "OnCollection" && (p.basis === "RevenuePercent" || p.basis === "CollectionBased"));
}

export function commissionAutomationState(plans: CommissionPlanLike[]): CommissionAutomationState {
  const eligible = eligiblePlansForAutoAccrual(plans);
  if (eligible.length === 0) return { status: "NoPlan" };
  if (eligible.length > 1) return { status: "Ambiguous", planNames: eligible.map((p) => p.name) };
  const plan = eligible[0];
  const rate = plan.ratePct === null || plan.ratePct === undefined ? 0 : Number(plan.ratePct.toString());
  if (!Number.isFinite(rate) || rate <= 0) return { status: "InvalidRate", planName: plan.name };
  return { status: "Active", planName: plan.name, ratePct: String(rate) };
}

export function commissionAutomationMessage(state: CommissionAutomationState): string {
  switch (state.status) {
    case "Active":
      return `العمولة بتتسجّل تلقائيًا عند تحصيل أي دفعة — ${state.ratePct}% حسب خطة «${state.planName}»، وبتتسجّل باسم مالك الفرصة بحالة «مستحقّة» لحد الاعتماد.`;
    case "NoPlan":
      return "مفيش خطة عمولة مؤهّلة للتسجيل التلقائي (خطة «عند التحصيل» بأساس نسبة من الإيراد أو على المحصَّل) — كل عمولة لازم تتسجّل بالإيد من صفحة الصفقة.";
    case "Ambiguous":
      return `فيه ${state.planNames.length} خطط مؤهّلة في نفس الوقت (${state.planNames.join("، ")}) — مفيش ربط بين الخطة والموظف في النظام، فمفيش طريقة نعرف أنهي خطة تتطبّق. «التسجيل التلقائي متوقّف» وكل عمولة لازم تتسجّل بالإيد. سيب خطة واحدة بس لو عايز الأتمتة ترجع.`;
    case "InvalidRate":
      return `خطة «${state.planName}» هي الوحيدة المؤهّلة لكن نسبتها فاضية أو صفر — «التسجيل التلقائي مش هيشتغل». حدّد نسبة أكبر من صفر.`;
  }
}

/** `true` للحالات اللي المستخدم لازم ياخد باله منها (مش مجرد معلومة). */
export function isCommissionAutomationWarning(state: CommissionAutomationState): boolean {
  return state.status !== "Active";
}
