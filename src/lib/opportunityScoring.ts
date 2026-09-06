/**
 * محرك اقتراح آلي (Rule-Based، مش AI/تخمين) لدرجتَي الفرصة والمخاطرة، بيستخدم بيانات حقيقية
 * مسجّلة فعليًا في النظام (مخاطرة السوق + مواسم توفّر المنتج + بيانات المنافسين الموسمية) بدل ما
 * المستخدم يكتب رقمين من نفسه بلا أي سند. النتيجة اقتراح قابل للتعديل بالكامل، مش قيد صلب —
 * وكل رقم فيه سبب واضح في `reasoning` (نفس فلسفة "ممنوع رقم بلا تبرير" المتبعة مع تحاليل AI).
 */

export type ScoringCompetitor = { strengthMonths: number[]; weaknessMonths: number[] };

export type ScoringInput = {
  politicalRiskScore: number | null;
  logisticsRiskScore: number | null;
  productAvailableMonths: number[];
  competitors: ScoringCompetitor[];
};

export type ScoringResult = {
  opportunityScore: number;
  riskScore: number;
  reasoning: string[];
};

export function computeOpportunityRiskSuggestion(input: ScoringInput): ScoringResult {
  const reasoning: string[] = [];

  // درجة المخاطرة = متوسط مخاطرة السوق السياسية/اللوجستية المسجّلة فعليًا.
  const riskParts = [input.politicalRiskScore, input.logisticsRiskScore].filter((v): v is number => v !== null);
  let riskScore: number;
  if (riskParts.length === 0) {
    riskScore = 50;
    reasoning.push("مفيش تقييم مخاطرة مسجّل لهذا السوق (سياسية/لوجستية) — درجة محايدة افتراضية 50، سجّلها في صفحة السوق عشان اقتراح أدق.");
  } else {
    riskScore = Math.round(riskParts.reduce((a, b) => a + b, 0) / riskParts.length);
    reasoning.push(
      `متوسط المخاطرة السياسية (${input.politicalRiskScore ?? "غير مقيَّمة"}) واللوجستية (${input.logisticsRiskScore ?? "غير مقيَّمة"}) لهذا السوق = ${riskScore}.`
    );
  }

  // درجة الفرصة = قاعدة 70، مخصومة حسب تشبّع السوق بالمنافسين، ومعدَّلة حسب التقاطع الموسمي.
  let opportunityScore = 70;
  const competitorCount = input.competitors.length;
  const competitionPenalty = Math.min(50, competitorCount * 8);
  opportunityScore -= competitionPenalty;
  reasoning.push(
    competitorCount > 0
      ? `${competitorCount} منافس مسجّل لنفس المنتج/السوق — خصم ${competitionPenalty} نقطة (سوق أكتر تشبّعًا).`
      : "مفيش منافسين مسجّلين لنفس المنتج/السوق لحد دلوقتي — مفيش خصم تشبّع."
  );

  if (input.productAvailableMonths.length > 0 && competitorCount > 0) {
    const weakOverlap = input.competitors.reduce(
      (sum, c) => sum + input.productAvailableMonths.filter((m) => c.weaknessMonths.includes(m)).length,
      0
    );
    const strongOverlap = input.competitors.reduce(
      (sum, c) => sum + input.productAvailableMonths.filter((m) => c.strengthMonths.includes(m)).length,
      0
    );
    const seasonalBonus = Math.min(20, weakOverlap * 3);
    const seasonalPenalty = Math.min(20, strongOverlap * 3);
    opportunityScore += seasonalBonus - seasonalPenalty;
    if (seasonalBonus > 0) {
      reasoning.push(`مواسم توفّرنا بتتقاطع مع شهور ضعف المنافسين في ${weakOverlap} حالة — إضافة ${seasonalBonus} نقطة (نافذة فرصة موسمية).`);
    }
    if (seasonalPenalty > 0) {
      reasoning.push(`مواسم توفّرنا بتتقاطع مع شهور قوة المنافسين في ${strongOverlap} حالة — خصم ${seasonalPenalty} نقطة (منافسة مباشرة في نفس التوقيت).`);
    }
  } else if (input.productAvailableMonths.length === 0) {
    reasoning.push("مواسم توفّر المنتج عندنا مش مسجّلة — التقييم الموسمي اتجاهل (سجّلها في صفحة تفاصيل المنتج عشان اقتراح أدق).");
  }

  return {
    opportunityScore: Math.max(0, Math.min(100, Math.round(opportunityScore))),
    riskScore: Math.max(0, Math.min(100, riskScore)),
    reasoning,
  };
}

/** نافذة الفرصة الموسمية الحالية — بتتستخدم في لوحة مقارنة الأسواق: هل الشهر الحالي وقت
 * ضعف عند أغلب المنافسين المسجّلين في هذا المنتج/السوق (يعني فرصة تصدير حاليًا)؟ */
export function computeCurrentSeasonalWindow(competitors: ScoringCompetitor[], month: number): { weakCount: number; strongCount: number; total: number } {
  const weakCount = competitors.filter((c) => c.weaknessMonths.includes(month)).length;
  const strongCount = competitors.filter((c) => c.strengthMonths.includes(month)).length;
  return { weakCount, strongCount, total: competitors.length };
}
