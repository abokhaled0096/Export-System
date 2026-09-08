import type OpenAI from "openai";
import { z } from "zod";
import { getAiClientForOrg } from "./client";
import { parseJsonBlock, extractSources, describeOpenAiError } from "./openaiHelpers";
import { tavilySearch, formatSourcesForPrompt } from "./tavilySearch";

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

const JSON_INSTRUCTIONS = `في آخر ردك، وبعد ما تخلص تحليل، اكتب فقرة قصيرة (بالعربي) تلخّص فيها المشهد التنافسي العام، وبعدها ضع بلوك JSON واحد بالضبط بالشكل ده (بلا أي نص زيادة جواه):

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

const SYSTEM_PROMPT_LEGACY = `أنت محلل استخبارات تنافسية لتصدير منتجات زراعية/غذائية. مهمتك تحديد **الدول المصدّرة المنافسة الحقيقية** لمنتج مصري معيّن في سوق دولة مستوردة معيّنة، بالاعتماد على بحث حقيقي وحديث في الإنترنت (بيانات تجارة، مواسم حصاد، أسعار تصدير فعلية) — مش تخمين عام ولا قائمة نظرية.

استخدم أداة البحث بقدر ما تحتاج للتأكد من:
- إيه الدول اللي فعليًا بتصدّر نفس المنتج (أو بديل قريب منه) لنفس السوق ده.
- مواسم الحصاد/التوريد بتاعتهم (عشان نحدد شهور قوتهم وضعفهم — لو مفيش بيانات موسمية واضحة، سيب المصفوفتين فاضيين بدل التخمين).
- نطاق سعر التصدير التقريبي بتاعهم لو متاح (لو مش لاقي رقم فعلي، سيب priceRangeMin/priceRangeMax = null بدل ما تخترع رقم).

لو ملقتش منافس حقيقي واحد حتى بعد بحث فعلي، رجّع مصفوفة "competitors" فاضية — أحسن من اختراع منافسين وهميين.

${JSON_INSTRUCTIONS}`;

const SYSTEM_PROMPT_TAVILY = `أنت محلل استخبارات تنافسية لتصدير منتجات زراعية/غذائية. مهمتك تحديد **الدول المصدّرة المنافسة الحقيقية** لمنتج مصري معيّن في سوق دولة مستوردة معيّنة، بالاعتماد **حصريًا** على نتائج البحث الحقيقية المرفقة في رسالة المستخدم تحت (بيانات تجارة، مواسم حصاد، أسعار تصدير فعلية) — ممنوع تختراع منافس أو رقم مش مذكور في النتائج المرفقة.

لو النتائج المرفقة ملهاش منافس حقيقي واضح، رجّع مصفوفة "competitors" فاضية — أحسن من اختراع منافسين وهميين.

${JSON_INSTRUCTIONS}`;

export async function analyzeCompetitorsWithAI(product: ProductInput, market: MarketInput, orgId: string): Promise<AiCompetitor[]> {
  const { client, model, usingCustomSettings, tavilyApiKey } = await getAiClientForOrg(orgId);

  const taskMessage = `ابحث عن المنافسين الحقيقيين لتصدير المنتج ده لسوق الدولة دي:

المنتج: ${product.nameAr} (${product.nameEn}) — HS Code: ${product.hsCode}، الفئة: ${product.category}، بلد المنشأ: ${product.originCountry}
${product.availableMonths.length > 0 ? `مواسم توفّر المنتج عندنا (أرقام شهور): ${product.availableMonths.join("، ")}` : ""}
السوق المستهدف: ${market.countryNameAr} (${market.countryNameEn}, ${market.countryCode}) — العملة المحلية: ${market.currency}`;

  if (tavilyApiKey) {
    let searchResults;
    try {
      searchResults = await tavilySearch(
        tavilyApiKey,
        `${product.nameEn} export competitors countries ${market.countryNameEn} import 2026 price season`
      );
    } catch (e) {
      throw e instanceof Error ? e : new Error("حصل خطأ أثناء البحث الحقيقي عن المنافسين.");
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
    const sources = searchResults.map((s) => ({ title: s.title, url: s.url }));
    return parsed.competitors.map((c) => ({ ...c, sources }));
  }

  if (usingCustomSettings) {
    throw new Error("مزوّد الذكاء الاصطناعي المخصّص محتاج مفتاح Tavily للبحث الحقيقي — اضبطه من /admin/ai-settings قبل التحليل.");
  }

  let response: OpenAI.Responses.Response;
  try {
    response = await client.responses.create({
      model,
      instructions: SYSTEM_PROMPT_LEGACY,
      input: `${taskMessage}\n\nابحث فعليًا (2026) عن الدول اللي بتصدّر نفس المنتج فعليًا لنفس السوق ده قبل ما تديني القائمة.`,
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

  // نفس المصادر بتتنسب لكل المنافسين اللي رجعوا في نفس الرد — البحث كان واحد شامل، مش بحث منفصل لكل دولة.
  return parsed.competitors.map((c) => ({ ...c, sources }));
}
