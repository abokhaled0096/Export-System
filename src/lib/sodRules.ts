/**
 * حالة قاعدة فصل المهام **الفعلية** — مش `isActive` لوحدها.
 *
 * ## ليه
 *
 * الـTrigger `enforce_segregation_of_duty_payment` بيشترط **شرطين** مع بعض:
 * `isActive = true` **و** `mustBeDifferentUser = true`. الشاشة كانت بتعرض الشارة من
 * `isActive` بس — فقاعدة متسجّلة بـ«أشخاص مختلفين = لا» كانت بتظهر **«مفعّلة» بخلفية
 * خضرا** وهي مابتمنعش أي حاجة.
 *
 * اتكشف بتسجيل القاعدة من الشاشة نفسها (1 أكتوبر): سجّلت Payment.Create/Payment.Approve،
 * الـcheckbox مادخلش، والصف ظهر «مفعّلة» وفصل المهام مقفول فعليًا. ده أسوأ من إنها
 * تبان موقوفة — مسؤول الامتثال بيبص على الشاشة، يشوف أخضر، ويمشي.
 *
 * نفس فئة العيوب المتكررة في المراجعة دي: القاعدة سليمة، والمشكلة إن حالتها الحقيقية
 * مش ظاهرة.
 */

export type SodRuleLike = { isActive: boolean; mustBeDifferentUser: boolean };

/** القاعدة بتمنع فعلًا؟ نفس شرط الـTrigger بالحرف. */
export function isSodRuleEnforcing(rule: SodRuleLike): boolean {
  return rule.isActive && rule.mustBeDifferentUser;
}

export function sodRuleEffectiveLabel(rule: SodRuleLike): string {
  if (!rule.isActive) return "موقوفة";
  if (!rule.mustBeDifferentUser) return "مسجّلة — مابتمنعش";
  return "مفعّلة وبتمنع";
}

export function sodRuleEffectiveStyle(rule: SodRuleLike): string {
  if (!rule.isActive) return "bg-secondary text-secondary-foreground hover:bg-secondary";
  if (!rule.mustBeDifferentUser) return "bg-amber-100 text-amber-800 hover:bg-amber-100";
  return "bg-emerald-100 text-emerald-700 hover:bg-emerald-100";
}
