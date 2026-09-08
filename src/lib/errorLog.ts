import { prisma } from "./prisma";
import { ZodError } from "zod";

/**
 * أي استثناء بيحمل `digest` يبدأ بـ`NEXT_` (redirect()/notFound()/الخ) مش خطأ حقيقي —
 * ده آلية التحكم الداخلية بتاعة Next.js نفسها، ولازم يتفلت لفوق زي ما هو، مش يتسجّل
 * ولا يتحوّل لـformError. راجع BACKLOG.md/STATUS.md § متابعة الأخطاء (30 أغسطس) —
 * اكتُشف باگ حقيقي: بعض الـServer Actions كانت بتحط `requireCurrentUser()` (اللي بينادي
 * `redirect()` لو الجلسة انتهت) جوه `try` بلا فحص، فالـredirect كان بيتبتلع ويرجع
 * formError عام بدل ما يودّي المستخدم لصفحة الدخول.
 */
export function isNextControlFlowError(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    "digest" in e &&
    typeof (e as { digest?: unknown }).digest === "string" &&
    (e as { digest: string }).digest.startsWith("NEXT_")
  );
}

/**
 * استخراج رسالة قاعدة البيانات النضيفة من استثناء Prisma.
 *
 * قواعد العمل الحرجة في المنظومة مفروضة كـTriggers بترمي `RAISE EXCEPTION` برسالة عربية
 * مكتوبة للمستخدم النهائي، لكن Prisma بيلفّها في نص تقني ("Invalid `prisma.invoice.update()`
 * invocation: ... Database error. Code: `23514`. Message: `...`") — فالمستخدم بيشوف ضجيج
 * بدل السبب. الدالة دي بتطلّع الرسالة الجوّانية بس؛ ولو مش لاقياها بترجع `fallback` بدل ما
 * تسرّب تفاصيل داخلية عن القاعدة.
 */
export function businessRuleMessage(error: unknown, fallback: string): string {
  if (!(error instanceof Error)) return fallback;

  // ZodError.message عبارة عن JSON خام (مصفوفة issues) — مش نص مكتوب للمستخدم أبدًا، حتى لو
  // مفيهوش "Invalid `prisma." (اتكشف وقت مراجعة رسائل الخطأ 8 سبتمبر: سكيمات التحقق من رد
  // الذكاء الاصطناعي — analyzeCompetitors.ts/analyzeMarket.ts — بترمي ZodError لو الرد جه
  // بشكل غير متوقع، وكان ممكن يوصل كـJSON خام للمستخدم بدل رسالة عربية مفهومة).
  if (error instanceof ZodError) return fallback;

  const dbMessage = error.message.match(/Message: `([^`]+)`/)?.[1];
  if (dbMessage) return dbMessage;

  // أخطاء بترمي من كود التطبيق نفسه (محرك الترحيل مثلًا) رسايلها مكتوبة للمستخدم أصلًا —
  // بنميّزها بإنها مفيهاش نص Prisma التقني.
  if (!error.message.includes("Invalid `prisma.")) return error.message;

  return fallback;
}

/**
 * سباق نادر: طلبين بنفس idempotencyKey (نفس فتحة الفورم) وصلوا للـinsert في نفس اللحظة قبل
 * ما فحص "موجود بالفعل؟" ياخد باله — الـ`@@unique([orgId, idempotencyKey])` هو خط الدفاع
 * الأخير. لازم يتفرّق عن أي P2002 تاني (رقم فاتورة/دفعة مكرر مثلًا) قبل ما نعتبره "مكرر آمن".
 */
export function isIdempotencyKeyConflict(e: unknown): boolean {
  if (typeof e !== "object" || e === null || (e as { code?: unknown }).code !== "P2002") return false;
  const meta = (e as { meta?: unknown }).meta;
  if (typeof meta !== "object" || meta === null) return false;
  // شكل الـmeta بيختلف حسب الـdriver adapter (target مباشر، أو driverAdapterError.cause.constraint.fields،
  // أو اسم الـconstraint جوه originalMessage بس) — التسلسل النصي الكامل بيغطّي الحالتين بأمان.
  return JSON.stringify(meta).includes("idempotencyKey");
}

/**
 * تسجيل استثناء غير متوقع في `ErrorLog` (insert-only، راجع prisma/schema.prisma).
 * بـraw prisma عمدًا (مش scoped-prisma) — لازم ينجح حتى لو مفيش سياق RLS صالح وقت الخطأ
 * (مثلًا الجلسة نفسها فشلت). فاشلة التسجيل نفسها متتسببش في كراش تاني — بتتبلع وتتطبع
 * في console السيرفر بس، عشان الخطأ الأصلي هو اللي المستخدم لازم يشوف رسالته.
 */
export async function logError(params: {
  orgId?: string | null;
  userId?: string | null;
  action: string;
  error: unknown;
}) {
  const message = params.error instanceof Error ? params.error.message : String(params.error);
  const stack = params.error instanceof Error ? params.error.stack : undefined;

  try {
    await prisma.errorLog.create({
      data: {
        orgId: params.orgId ?? undefined,
        userId: params.userId ?? undefined,
        action: params.action,
        message,
        stack,
      },
    });
  } catch (loggingError) {
    console.error("[errorLog] فشل تسجيل الخطأ في القاعدة:", loggingError);
  }

  console.error(`[${params.action}]`, params.error);
}
