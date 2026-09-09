import OpenAI from "openai";
import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/vault";

const DEFAULT_MODEL = "gpt-4o-mini";

/** بيجهّز عميل الذكاء الاصطناعي والموديل للمنظمة الحالية — بيقرا الإعدادات المخصّصة من
 * Organization لو الأدمن ضبطها من /admin/ai-settings (مفتاح مشفّر عبر Vault + Base URL
 * + اسم موديل)، وإلا بيرجع لـOPENAI_API_KEY من .env والموديل الافتراضي (توافق خلفي كامل).
 *
 * orgId بارامتر صريح مش من session — نفس نمط دوال src/lib/accounting.ts، الاستدعاء بيتم من
 * Server Action عمل requireCurrentUser() بالفعل، وده خط الدفاع.
 *
 * تغيير الـBase URL يشتغل تلقائي مع أي مزوّد بيدعم صيغة OpenAI (chat/responses API) — أغلب
 * الموديلات الحديثة (مباشرة أو عبر مجمّعات زي OpenRouter) — بلا أي تعديل كود. مزوّد بصيغة
 * مختلفة تمامًا هيرجع خطأ واضح وقت أول استدعاء (راجع describeOpenAiError في openaiHelpers.ts)،
 * مش فشل صامت.
 *
 * tavilyApiKey: بعض المزوّدين بيقبلوا أداة web_search شكليًا لكن بيرجّعوا "بحث" وهمي بلا تحذير
 * (اتأكد ده فعليًا مع موديل خارجي جُرّب). لتفادي بحث وهمي صامت، analyzeMarket.ts/analyzeCompetitors.ts
 * بيستخدموا Tavily (بحث مستقل تمامًا عن الموديل) لو مفتاحه متسجّل، وإلا بيرفضوا يشتغلوا مع أي
 * مزوّد مخصّص (usingCustomSettings=true) بلا Tavily بدل المخاطرة ببحث وهمي.
 *
 * models: حقل aiModel بيقبل أكتر من موديل مفصولين بفاصلة — الأول هو الأساسي والباقي احتياطي
 * بالترتيب لو الأساسي رجع خطأ سعة (كوتة/ضغط/timeout). راجع chatCompletionWithModelFallback. */
export async function getAiClientForOrg(
  orgId: string
): Promise<{ client: OpenAI; models: string[]; usingCustomSettings: boolean; tavilyApiKey: string | null }> {
  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: orgId },
    select: { aiApiKeySecretId: true, aiBaseUrl: true, aiModel: true, tavilyApiKeySecretId: true },
  });

  const apiKey = org.aiApiKeySecretId ? await decryptSecret(org.aiApiKeySecretId) : process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("محتاج تضبط مفتاح API للذكاء الاصطناعي — من /admin/ai-settings أو OPENAI_API_KEY في .env.");
  }

  const tavilyApiKey = org.tavilyApiKeySecretId ? await decryptSecret(org.tavilyApiKeySecretId) : null;

  const configuredModels = (org.aiModel ?? "").split(",").map((m) => m.trim()).filter(Boolean);

  return {
    // timeout صريح — الافتراضي في الـSDK 10 دقايق، وده كتير جدًا لخطوة واحدة في دفعة polling
    // (لوحظ حيًا: dahl.global تحت ضغط بيرجّع 429 بـRetry-After طويل، والـSDK بيحترمه تلقائيًا
    // فالانتظار يتراكم لعشرات الدقايق لتركيبة واحدة ويوقف الدفعة كلها فعليًا). 90 ثانية —
    // موديلات Gemini "thinking" بتاخد 25-40 ثانية عادي لطلب واحد (استهلاك توكنز تفكير مخفية)،
    // و45 ثانية كانت قصيرة جدًا وبتفشّل طلبات سليمة بـ"Request timed out" (اتلاحظ حيًا).
    // maxRetries أعلى شوية من الافتراضي (2) — موديلات مجانية بترجّع 503 "high demand" بشكل
    // شائع ومؤقت، محاولة إضافية بتنجح غالبًا بلا ما تعلّق الدفعة كتير.
    client: new OpenAI({ apiKey, baseURL: org.aiBaseUrl || undefined, timeout: 90_000, maxRetries: 3 }),
    models: configuredModels.length > 0 ? configuredModels : [DEFAULT_MODEL],
    usingCustomSettings: Boolean(org.aiApiKeySecretId),
    tavilyApiKey,
  };
}
