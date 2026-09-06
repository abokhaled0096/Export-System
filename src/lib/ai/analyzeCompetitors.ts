import OpenAI from "openai";
import { z } from "zod";

const CompetitorResultSchema = z.object({
  countryName: z.string().min(1),
  strengthMonths: z.array(z.number().int().min(1).max(12)).max(12),
  weaknessMonths: z.array(z.number().int().min(1).max(12)).max(12),
  priceRangeMin: z.number().nullable(),
  priceRangeMax: z.number().nullable(),
  currency: z.string().length(3),
  reasoning: z.string().min(10),
});

const AnalysisResultSchema = z.object({
  competitors: z.array(CompetitorResultSchema).max(10),
});

export type AiCompetitor = z.infer<typeof CompetitorResultSchema> & {
  sources: { title: string; url: string }[];
};

type ProductInput = { nameAr: string; nameEn: string; hsCode: string; category: string; originCountry: string; availableMonths: number[] };
type MarketInput = { countryNameAr: string; countryNameEn: string; countryCode: string; currency: string };

/** نفس موديل analyzeMarket.ts بالحرف — أرخص عائلة gpt-4o بتدعم web_search. */
const MODEL = "gpt-4o-mini";

const SYSTEM_PROMPT = `أنت محلل استخبارات تنافسية لتصدير منتجات زراعية/غذائية. مهمتك تحديد **الدول المصدّرة المنافسة الحقيقية** لمنتج مصري معيّن في سوق دولة مستوردة معيّنة، بالاعتماد على بحث حقيقي وحديث في الإنترنت (بيانات تجارة، مواسم حصاد، أسعار تصدير فعلية) — مش تخمين عام ولا قائمة نظرية.

استخدم أداة البحث بقدر ما تحتاج للتأكد من:
- إيه الدول اللي فعليًا بتصدّر نفس المنتج (أو بديل قريب منه) لنفس السوق ده.
- مواسم الحصاد/التوريد بتاعتهم (عشان نحدد شهور قوتهم وضعفهم — لو مفيش بيانات موسمية واضحة، سيب المصفوفتين فاضيين بدل التخمين).
- نطاق سعر التصدير التقريبي بتاعهم لو متاح (لو مش لاقي رقم فعلي، سيب priceRangeMin/priceRangeMax = null بدل ما تخترع رقم).

لو ملقتش منافس حقيقي واحد حتى بعد بحث فعلي، رجّع مصفوفة "competitors" فاضية — أحسن من اختراع منافسين وهميين.

في آخر ردك، وبعد ما تخلص بحث وتحليل، اكتب فقرة قصيرة (بالعربي) تلخّص فيها المشهد التنافسي العام، وبعدها ضع بلوك JSON واحد بالضبط بالشكل ده (بلا أي نص زيادة جواه):

\`\`\`json
{
  "competitors": [
    {
      "countryName": "<اسم الدولة المنافسة>",
      "strengthMonths": [<أرقام شهور 1-12 دي دولة قوية فيها موسميًا، ممكن تكون فاضية>],
      "weaknessMonths": [<أرقام شهور 1-12 دي دولة ضعيفة/غايبة فيها، ممكن تكون فاضية>],
      "priceRangeMin": <رقم أو null>,
      "priceRangeMax": <رقم أو null>,
      "currency": "<كود عملة ISO 4217 لسعر التصدير، زي USD>",
      "reasoning": "<جملة أو اتنين توضح مصدر المعلومة دي تحديدًا>"
    }
  ]
}
\`\`\`

القاعدة: أي منافس بلا سبب واضح في reasoning غير مقبول — لازم يبان في التبرير إيه اللي أكّد إن الدولة دي منافس حقيقي فعلي.`;

function parseCompetitorsJson(text: string) {
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

/** نفس منطق analyzeMarket.ts بالحرف — مصادر حقيقية من url_citation annotations بس. */
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

export async function analyzeCompetitorsWithAI(product: ProductInput, market: MarketInput): Promise<AiCompetitor[]> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("محتاج تضيف OPENAI_API_KEY في ملف .env الأول (احصل عليه من platform.openai.com) وتعيد تشغيل السيرفر.");
  }

  const client = new OpenAI();

  const userMessage = `ابحث عن المنافسين الحقيقيين لتصدير المنتج ده لسوق الدولة دي:

المنتج: ${product.nameAr} (${product.nameEn}) — HS Code: ${product.hsCode}، الفئة: ${product.category}، بلد المنشأ: ${product.originCountry}
${product.availableMonths.length > 0 ? `مواسم توفّر المنتج عندنا (أرقام شهور): ${product.availableMonths.join("، ")}` : ""}
السوق المستهدف: ${market.countryNameAr} (${market.countryNameEn}, ${market.countryCode}) — العملة المحلية: ${market.currency}

ابحث فعليًا (2026) عن الدول اللي بتصدّر نفس المنتج فعليًا لنفس السوق ده قبل ما تديني القائمة.`;

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

  const parsed = parseCompetitorsJson(response.output_text);
  const sources = extractSources(response);

  // نفس المصادر بتتنسب لكل المنافسين اللي رجعوا في نفس الرد — البحث كان واحد شامل، مش بحث منفصل لكل دولة.
  return parsed.competitors.map((c) => ({ ...c, sources }));
}
