import OpenAI from "openai";
import { z } from "zod";

const AnalysisResultSchema = z.object({
  opportunityScore: z.number().int().min(0).max(100),
  riskScore: z.number().int().min(0).max(100),
  confidenceLevel: z.number().int().min(0).max(100),
  recommendation: z.enum(["Start", "Study", "Monitor", "Avoid"]),
  reasoning: z.string().min(20),
});

export type AiMarketAnalysis = z.infer<typeof AnalysisResultSchema> & {
  sources: { title: string; url: string }[];
};

type ProductInput = { nameAr: string; nameEn: string; hsCode: string; category: string; originCountry: string };
type MarketInput = { countryNameAr: string; countryNameEn: string; countryCode: string; currency: string };

/** الموديل الأرخص من عائلة gpt-4o اللي بتدعم web_search — راجع STATUS.md لو احتجت تغييره. */
const MODEL = "gpt-4o-mini";

const SYSTEM_PROMPT = `أنت محلل أسواق تصدير خبير. مهمتك تحليل فرصة تصدير منتج مصري لسوق دولة معيّنة، بالاعتماد على بحث حقيقي وحديث في الإنترنت (أسعار، منافسين، لوائح استيراد، اتفاقيات تجارية، طلب فعلي) — مش تخمين عام.

استخدم أداة البحث بقدر ما تحتاج للتأكد من معلومات حديثة فعلية عن السوق ده تحديدًا للمنتج ده تحديدًا.

في آخر ردك، وبعد ما تخلص بحث وتحليل، اكتب فقرة قصيرة توضح فيها أهم أسباب تقييمك (بالعربي)، وبعدها ضع بلوك JSON واحد بالضبط بالشكل ده بالظبط (بلا أي نص زيادة جواه):

\`\`\`json
{
  "opportunityScore": <رقم من 0 إلى 100>,
  "riskScore": <رقم من 0 إلى 100>,
  "confidenceLevel": <رقم من 0 إلى 100 — مدى ثقتك في التقييم ده بناءً على جودة المعلومات اللي لقيتها>,
  "recommendation": "<Start أو Study أو Monitor أو Avoid>",
  "reasoning": "<فقرة عربية واضحة تشرح سبب الدرجات والتوصية، بالاستناد لحاجات حقيقية لقيتها بالبحث>"
}
\`\`\`

القاعدة: أي درجة بلا سبب واضح في reasoning غير مقبولة — لازم يبان في التبرير إيه اللي أثّر على القرار.`;

/** بيستخرج آخر بلوك ```json من نص الرد ويتحقق منه بـZod. */
function parseAnalysisJson(text: string) {
  const matches = [...text.matchAll(/```json\s*([\s\S]*?)```/g)];
  if (matches.length === 0) {
    throw new Error("رد الذكاء الاصطناعي ما فيهوش JSON بالصيغة المتوقعة.");
  }
  const lastMatch = matches[matches.length - 1][1];
  let parsed: unknown;
  try {
    parsed = JSON.parse(lastMatch);
  } catch {
    throw new Error("رد الذكاء الاصطناعي فيه JSON غير صالح.");
  }
  const result = AnalysisResultSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error("رد الذكاء الاصطناعي ما طابقش الصيغة المطلوبة: " + result.error.message);
  }
  return result.data;
}

/** يجمع مصادر البحث الحقيقية من url_citation annotations — مش من نص الرد (تفادي هلوسة روابط). */
function extractSources(response: OpenAI.Responses.Response) {
  const sources: { title: string; url: string }[] = [];
  for (const item of response.output) {
    if (item.type !== "message") continue;
    for (const content of item.content) {
      if (content.type !== "output_text") continue;
      for (const annotation of content.annotations) {
        if (annotation.type === "url_citation") {
          sources.push({ title: annotation.title || annotation.url, url: annotation.url });
        }
      }
    }
  }
  const seen = new Set<string>();
  return sources.filter((s) => (seen.has(s.url) ? false : (seen.add(s.url), true)));
}

/** يحوّل أخطاء OpenAI API لرسائل عربية واضحة بدل JSON خام. */
function describeOpenAiError(e: unknown): string {
  if (e instanceof OpenAI.AuthenticationError) {
    return "مفتاح OPENAI_API_KEY غير صحيح — تأكد إنه منسوخ صح من platform.openai.com في ملف .env.";
  }
  if (e instanceof OpenAI.RateLimitError) {
    const message = e.message ?? "";
    if (message.toLowerCase().includes("quota")) {
      return `الحساب ده مفيهوش رصيد فعلي كفاية (insufficient_quota) — لازم تضيف وسيلة دفع/رصيد على platform.openai.com → Billing. رسالة OpenAI الكاملة: ${message}`;
    }
    return `تم تجاوز الحد المسموح من الطلبات لحساب OpenAI ده مؤقتًا — حاول تاني بعد شوية. رسالة OpenAI الكاملة: ${message}`;
  }
  if (e instanceof OpenAI.BadRequestError) {
    return `طلب غير صالح لـOpenAI API: ${e.message}`;
  }
  if (e instanceof OpenAI.APIError) {
    return `خطأ من OpenAI API (${e.status}): ${e.message}`;
  }
  return e instanceof Error ? e.message : "حصل خطأ غير متوقع أثناء الاتصال بالذكاء الاصطناعي.";
}

export async function analyzeMarketWithAI(
  product: ProductInput,
  market: MarketInput
): Promise<AiMarketAnalysis> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error(
      "محتاج تضيف OPENAI_API_KEY في ملف .env الأول (احصل عليه من platform.openai.com) وتعيد تشغيل السيرفر."
    );
  }

  const client = new OpenAI();

  const userMessage = `حلل فرصة تصدير المنتج ده لسوق الدولة دي:

المنتج: ${product.nameAr} (${product.nameEn}) — HS Code: ${product.hsCode}، الفئة: ${product.category}، بلد المنشأ: ${product.originCountry}
السوق المستهدف: ${market.countryNameAr} (${market.countryNameEn}, ${market.countryCode}) — العملة المحلية: ${market.currency}

ابحث فعليًا عن الوضع الحالي (2026) لاستيراد هذا المنتج لهذه الدولة قبل ما تديني تقييمك.`;

  let response: OpenAI.Responses.Response;
  try {
    response = await client.responses.create({
      model: MODEL,
      instructions: SYSTEM_PROMPT,
      input: userMessage,
      tools: [{ type: "web_search" }],
    });
  } catch (e) {
    throw new Error(describeOpenAiError(e));
  }

  if (response.status === "incomplete") {
    throw new Error("الرد اتقطع قبل ما يخلص — جرب تاني.");
  }

  const parsed = parseAnalysisJson(response.output_text);
  const sources = extractSources(response);

  return { ...parsed, sources };
}
