import type OpenAI from "openai";
import { z } from "zod";
import { getAiClientForOrg } from "./client";
import { parseJsonBlock, extractSources, describeOpenAiError } from "./openaiHelpers";
import { multiTavilySearch, formatSourcesForPrompt } from "./tavilySearch";

const PriceEstimateSchema = z
  .object({
    min: z.number().nullable(),
    max: z.number().nullable(),
    currency: z.string().length(3),
  })
  .nullable();

const AnalysisResultSchema = z.object({
  opportunityScore: z.number().int().min(0).max(100),
  riskScore: z.number().int().min(0).max(100),
  confidenceLevel: z.number().int().min(0).max(100),
  recommendation: z.enum(["Start", "Study", "Monitor", "Avoid"]),
  reasoning: z.string().min(20),
  marketOverview: z.string().min(20),
  demandDrivers: z.array(z.string().min(3)).max(8),
  keyRisks: z.array(z.string().min(3)).max(8),
  regulatoryNotes: z.string().min(10),
  priceEstimate: PriceEstimateSchema,
  recommendedNextSteps: z.array(z.string().min(3)).max(8),
});

export type AiMarketAnalysis = z.infer<typeof AnalysisResultSchema> & {
  sources: { title: string; url: string }[];
};

type ProductInput = { nameAr: string; nameEn: string; hsCode: string; category: string; originCountry: string };
type MarketInput = { countryNameAr: string; countryNameEn: string; countryCode: string; currency: string };

const JSON_INSTRUCTIONS = `في آخر ردك، وبعد ما تخلص تحليل، اكتب فقرة قصيرة توضح فيها أهم أسباب تقييمك (بالعربي)، وبعدها ضع بلوك JSON واحد بالضبط بالشكل ده بالظبط (بلا أي نص زيادة جواه):

\`\`\`json
{
  "opportunityScore": <رقم من 0 إلى 100>,
  "riskScore": <رقم من 0 إلى 100>,
  "confidenceLevel": <رقم من 0 إلى 100 — مدى ثقتك في التقييم ده بناءً على جودة المعلومات اللي لقيتها>,
  "recommendation": "<Start أو Study أو Monitor أو Avoid>",
  "reasoning": "<فقرة عربية واضحة تشرح سبب الدرجات والتوصية، بالاستناد لحاجات حقيقية لقيتها بالبحث>",
  "marketOverview": "<فقرة عربية عن حجم السوق ومعدل نموه واتجاهه العام>",
  "demandDrivers": ["<سبب طلب حقيقي 1>", "<سبب طلب حقيقي 2>", "..."],
  "keyRisks": ["<خطر حقيقي 1>", "<خطر حقيقي 2>", "..."],
  "regulatoryNotes": "<لوائح استيراد/تعريفات جمركية/شهادات مطلوبة لهذا المنتج في هذه الدولة تحديدًا>",
  "priceEstimate": {"min": <رقم أو null>, "max": <رقم أو null>, "currency": "<كود عملة ISO 4217>"} أو null لو مفيش بيانات سعر حقيقية،
  "recommendedNextSteps": ["<خطوة عملية موصى بها 1>", "<خطوة عملية موصى بها 2>", "..."]
}
\`\`\`

القاعدة: أي درجة أو بند بلا سبب واضح غير مقبول — لازم يبان في النص إيه اللي أثّر على القرار. لو معلومة معيّنة (زي السعر) مش متوفرة فعليًا في البحث، سيبها null/فاضية بدل ما تخترعها.`;

const SYSTEM_PROMPT_LEGACY = `أنت محلل أسواق تصدير خبير. مهمتك تحليل فرصة تصدير منتج مصري لسوق دولة معيّنة، بالاعتماد على بحث حقيقي وحديث في الإنترنت (أسعار، منافسين، لوائح استيراد، اتفاقيات تجارية، طلب فعلي) — مش تخمين عام.

استخدم أداة البحث بقدر ما تحتاج للتأكد من معلومات حديثة فعلية عن السوق ده تحديدًا للمنتج ده تحديدًا. ابحث عن حجم السوق ومعدل نموه، اللوائح التنظيمية والتعريفات الجمركية والشهادات المطلوبة، ونطاق الأسعار الفعلي — مش تقييم سطحي برقم واحد بس.

${JSON_INSTRUCTIONS}`;

const SYSTEM_PROMPT_TAVILY = `أنت محلل أسواق تصدير خبير. مهمتك تحليل فرصة تصدير منتج مصري لسوق دولة معيّنة، بالاعتماد **حصريًا** على نتائج البحث الحقيقية المرفقة في رسالة المستخدم تحت (أسعار، منافسين، لوائح استيراد، اتفاقيات تجارية، طلب فعلي) — ممنوع تختراع أو تفترض معلومة مش موجودة في النتائج المرفقة؛ لو المعلومة ناقصة، قول كده صراحة في الحقل المناسب (نص يوضح النقص، أو null للأرقام) وقلّل confidenceLevel.

${JSON_INSTRUCTIONS}`;

export async function analyzeMarketWithAI(
  product: ProductInput,
  market: MarketInput,
  orgId: string
): Promise<AiMarketAnalysis> {
  const { client, model, usingCustomSettings, tavilyApiKey } = await getAiClientForOrg(orgId);

  const taskMessage = `حلل فرصة تصدير المنتج ده لسوق الدولة دي:

المنتج: ${product.nameAr} (${product.nameEn}) — HS Code: ${product.hsCode}، الفئة: ${product.category}، بلد المنشأ: ${product.originCountry}
السوق المستهدف: ${market.countryNameAr} (${market.countryNameEn}, ${market.countryCode}) — العملة المحلية: ${market.currency}`;

  if (tavilyApiKey) {
    let searchResults;
    try {
      searchResults = await multiTavilySearch(tavilyApiKey, [
        `${product.nameEn} demand market size growth ${market.countryNameEn} 2026`,
        `${product.nameEn} import regulations tariffs certification requirements ${market.countryNameEn}`,
        `${product.nameEn} export price competition ${market.countryNameEn} 2026`,
      ]);
    } catch (e) {
      throw e instanceof Error ? e : new Error("حصل خطأ أثناء البحث الحقيقي عن السوق.");
    }

    let completion;
    try {
      completion = await client.chat.completions.create({
        model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT_TAVILY },
          { role: "user", content: `${taskMessage}\n\nنتائج بحث حقيقية حديثة (2026):\n\n${formatSourcesForPrompt(searchResults)}` },
        ],
      });
    } catch (e) {
      throw new Error(describeOpenAiError(e, usingCustomSettings));
    }

    const text = completion.choices[0]?.message.content ?? "";
    const parsed = parseJsonBlock(text, AnalysisResultSchema);
    return { ...parsed, sources: searchResults.map((s) => ({ title: s.title, url: s.url })) };
  }

  if (usingCustomSettings) {
    throw new Error("مزوّد الذكاء الاصطناعي المخصّص محتاج مفتاح Tavily للبحث الحقيقي — اضبطه من /admin/ai-settings قبل التحليل.");
  }

  let response: OpenAI.Responses.Response;
  try {
    response = await client.responses.create({
      model,
      instructions: SYSTEM_PROMPT_LEGACY,
      input: `${taskMessage}\n\nابحث فعليًا عن الوضع الحالي (2026) لاستيراد هذا المنتج لهذه الدولة قبل ما تديني تقييمك.`,
      tools: [{ type: "web_search" }],
    });
  } catch (e) {
    throw new Error(describeOpenAiError(e, usingCustomSettings));
  }

  if (response.status === "incomplete") {
    throw new Error("الرد اتقطع قبل ما يخلص — جرب تاني.");
  }

  const parsed = parseJsonBlock(response.output_text, AnalysisResultSchema);
  const sources = extractSources(response);

  return { ...parsed, sources };
}
