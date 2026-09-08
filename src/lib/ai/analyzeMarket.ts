import type OpenAI from "openai";
import { z } from "zod";
import { getAiClientForOrg } from "./client";
import { parseJsonBlock, extractSources, describeOpenAiError } from "./openaiHelpers";
import { tavilySearch, formatSourcesForPrompt } from "./tavilySearch";

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

const JSON_INSTRUCTIONS = `في آخر ردك، وبعد ما تخلص تحليل، اكتب فقرة قصيرة توضح فيها أهم أسباب تقييمك (بالعربي)، وبعدها ضع بلوك JSON واحد بالضبط بالشكل ده بالظبط (بلا أي نص زيادة جواه):

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

const SYSTEM_PROMPT_LEGACY = `أنت محلل أسواق تصدير خبير. مهمتك تحليل فرصة تصدير منتج مصري لسوق دولة معيّنة، بالاعتماد على بحث حقيقي وحديث في الإنترنت (أسعار، منافسين، لوائح استيراد، اتفاقيات تجارية، طلب فعلي) — مش تخمين عام.

استخدم أداة البحث بقدر ما تحتاج للتأكد من معلومات حديثة فعلية عن السوق ده تحديدًا للمنتج ده تحديدًا.

${JSON_INSTRUCTIONS}`;

const SYSTEM_PROMPT_TAVILY = `أنت محلل أسواق تصدير خبير. مهمتك تحليل فرصة تصدير منتج مصري لسوق دولة معيّنة، بالاعتماد **حصريًا** على نتائج البحث الحقيقية المرفقة في رسالة المستخدم تحت (أسعار، منافسين، لوائح استيراد، اتفاقيات تجارية، طلب فعلي) — ممنوع تختراع أو تفترض معلومة مش موجودة في النتائج المرفقة؛ لو المعلومة ناقصة، قول كده صراحة في التبرير وقلّل confidenceLevel.

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
      searchResults = await tavilySearch(
        tavilyApiKey,
        `${product.nameEn} export import ${market.countryNameEn} 2026 market demand price regulations tariffs`
      );
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
