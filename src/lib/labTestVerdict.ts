/**
 * تناقضات الفحص المعملي — **تعريف واحد** بيستخدمه الفورم (تحذير وقت الإدخال)، وجدول
 * الدفعة (شارة على السطر)، وقسم الإفراج عن الجودة (منع الإفراج الكامل)، والـTrigger
 * في القاعدة (نفس المنطق بالـSQL).
 *
 * ## ليه ده موجود
 *
 * اتكشف بتجربة فعلية (30 سبتمبر): سجّلت فحص متبقيات مبيدات — `Chlorpyrifos`، الحد
 * الأقصى `0.05 mg/kg`، النتيجة الفعلية `0.12` — واخترت **«ناجح»**. السيستم قَبلها
 * وخزّنها بلا أي تحذير، وظهرت في جدول الدفعة بشارة خضراء.
 *
 * ده أخطر سطر ممكن يوجد في نظام تصدير غذائي: تجاوز حد متبقيات (MRL) متسجّل كـ«ناجح»
 * هو السبب الأول لرفض الشحنات على الحدود الأوروبية (RASFF). الحدود والنتيجة كانوا
 * ٤ حقول Zod مستقلة (`minLimit`, `maxLimit`, `actualResult`, `passFail`) بلا أي فحص
 * متقاطع بينهم في أي مكان في الكود.
 *
 * ## ليه تحذير مش منع (للتناقض)
 *
 * مش كل تناقض غلطة: إعادة فحص، عدم تأكد القياس (measurement uncertainty)، أو حدود
 * سوق مختلفة عن الحدود المسجّلة — كلها أسباب مشروعة لنتيجة «ناجح» فوق الحد المكتوب.
 * القرار: **مسموح تتسجّل، ممنوع تمرّ في صمت.** التناقض بيتشاف في ٣ أماكن، وبيمنع
 * **الإفراج الكامل** (`Released`) — واللي محتاج يُفرج فعلًا بيستخدم «إفراج مشروط»
 * (`ConditionalRelease`) وده قرار موثَّق باسمه في سجل التدقيق.
 *
 * أما `minLimit > maxLimit` فده **غلط إدخال** مش اجتهاد — بيتمنع في الـSchema.
 */

/** الأرقام جاية من Prisma كـ`Decimal` أو من الفورم كـ`string`/`number`. */
type Numeric = { toString(): string } | number | null | undefined;

function toNumber(value: Numeric): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value.toString());
  return Number.isFinite(n) ? n : null;
}

export type LabTestLimits = {
  minLimit?: Numeric;
  maxLimit?: Numeric;
  actualResult?: Numeric;
  passFail?: string | null;
};

export type LabTestConflict =
  /** النتيجة بره الحدود والحُكم «ناجح» — الحالة الخطيرة. */
  | "OutOfLimitButPass"
  /** النتيجة جوه الحدود والحُكم «فاشل» — مش خطر، لكن محتاج تفسير (معيار تانى؟). */
  | "WithinLimitButFail";

/** النتيجة بره النطاق `[minLimit, maxLimit]`؟ حد ناقص = مفتوح من الناحية دي. */
export function isResultOutOfLimits(test: LabTestLimits): boolean {
  const result = toNumber(test.actualResult);
  if (result === null) return false;
  const min = toNumber(test.minLimit);
  const max = toNumber(test.maxLimit);
  if (min !== null && result < min) return true;
  if (max !== null && result > max) return true;
  return false;
}

/** التناقض بين النتيجة الرقمية والحُكم، أو `null` لو مفيش تناقض. */
export function labTestConflict(test: LabTestLimits): LabTestConflict | null {
  if (toNumber(test.actualResult) === null) return null;
  const hasLimit = toNumber(test.minLimit) !== null || toNumber(test.maxLimit) !== null;
  if (!hasLimit) return null;
  const outOfLimits = isResultOutOfLimits(test);
  if (outOfLimits && test.passFail === "Pass") return "OutOfLimitButPass";
  if (!outOfLimits && test.passFail === "Fail") return "WithinLimitButFail";
  return null;
}

export const labTestConflictLabel: Record<LabTestConflict, string> = {
  OutOfLimitButPass: "⚠ خارج الحد",
  WithinLimitButFail: "؟ داخل الحد",
};

export const labTestConflictStyle: Record<LabTestConflict, string> = {
  OutOfLimitButPass: "bg-rose-600 text-white hover:bg-rose-600",
  WithinLimitButFail: "bg-amber-100 text-amber-800 hover:bg-amber-100",
};

export const labTestConflictHint: Record<LabTestConflict, string> = {
  OutOfLimitButPass: "النتيجة الفعلية بره الحدود المسجَّلة لكن الحُكم «ناجح» — راجع الحدود أو الحُكم قبل الإفراج.",
  WithinLimitButFail: "النتيجة الفعلية جوه الحدود المسجَّلة لكن الحُكم «فاشل» — وضّح المعيار اللي على أساسه رسب.",
};

/**
 * الفحوصات اللي **بتمنع الإفراج الكامل** عن الدفعة: أي فحص فاشل، أو أي فحص نتيجته
 * بره حدوده (حتى لو متسجّل «ناجح» — التناقض نفسه بيمنع). نفس المنطق متكرّر كـTrigger
 * في `enforce_quality_release_lab_tests` — أي تعديل هنا لازم يتعدّل هناك.
 */
export function labTestsBlockingFullRelease<T extends LabTestLimits>(tests: T[]): T[] {
  return tests.filter((t) => t.passFail === "Fail" || isResultOutOfLimits(t));
}
