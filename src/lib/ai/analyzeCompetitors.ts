import { z } from "zod";
import { getAiClientForOrg } from "./client";
import { parseJsonBlock, describeOpenAiError, chatCompletionWithModelFallback, describeProductContext, describeMarketContext } from "./openaiHelpers";
import { multiTavilySearch, formatSourcesForPrompt, type TavilySource } from "./tavilySearch";
import { vetSources } from "./sourceVetting";

const CITATION_PATTERN = /\[\d+\]/;

const CompetitorResultSchema = z.object({
  countryName: z.string().min(1),
  strengthMonths: z.array(z.number().int().min(1).max(12)).max(12),
  weaknessMonths: z.array(z.number().int().min(1).max(12)).max(12),
  priceRangeMin: z.number().nullable(),
  priceRangeMax: z.number().nullable(),
  currency: z.string().length(3),
  reasoning: z.string().min(10).refine((v) => CITATION_PATTERN.test(v), "reasoning لازم يحتوي على مرجع مصدر [n] واحد على الأقل"),
});

const AnalysisResultSchema = z.object({
  competitors: z.array(CompetitorResultSchema).max(10),
});

export type AiCompetitor = z.infer<typeof CompetitorResultSchema> & {
  sources: { title: string; url: string; publishedDate: string | null }[];
};

type ProductInput = {
  nameAr: string;
  nameEn: string;
  hsCode: string;
  category: string;
  originCountry: string;
  availableMonths: number[];
  harvestSeason: string | null;
  shelfLifeDays: number | null;
  storageTempC: unknown;
  requiresRefrigeration: boolean;
};
type MarketInput = {
  countryNameAr: string;
  countryNameEn: string;
  countryCode: string;
  currency: string;
  tradeAgreement: string | null;
  politicalRiskScore: number | null;
  logisticsRiskScore: number | null;
  mainPorts: string[];
};

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
      "reasoning": "<جملة أو اتنين توضح مصدر المعلومة دي تحديدًا، بمرجع [n] واضح للمصدر>"
    }
  ]
}
\`\`\`

القاعدة: أي منافس بلا مرجع مصدر [n] واضح في reasoning غير مقبول — لازم يبان في التبرير رقم المصدر اللي أكّد إن الدولة دي منافس حقيقي فعلي.

مهم جدًا لصحة الـJSON: جوه بنية الـJSON نفسها (الأقواس، الفواصل بين عناصر array، الأرقام) استخدم فاصلة إنجليزية "," وأرقام إنجليزية بس — الفاصلة العربية "،" مسموحة جوه نصوص الجمل بس.`;

const SYSTEM_PROMPT_TAVILY = `أنت محلل استخبارات تنافسية لتصدير منتجات زراعية/غذائية. مهمتك تحديد **الدول المصدّرة المنافسة الحقيقية** لمنتج مصري معيّن في سوق دولة مستوردة معيّنة، بالاعتماد **حصريًا** على نتائج البحث الحقيقية المرفقة في رسالة المستخدم تحت (بيانات تجارة، مواسم حصاد، أسعار تصدير فعلية) — ممنوع تختراع منافس أو رقم مش مذكور في النتائج المرفقة.

المصادر دي **اتفرزت مسبقًا** وكل واحد فيها متأكَّد إنه عن نفس المنتج ونفس الدولة تحديدًا. لو النتائج ملهاش منافس حقيقي واضح، رجّع مصفوفة "competitors" فاضية — أحسن من اختراع منافسين وهميين.

${JSON_INSTRUCTIONS}`;

export async function analyzeCompetitorsWithAI(product: ProductInput, market: MarketInput, orgId: string): Promise<AiCompetitor[]> {
  const { client, models, usingCustomSettings, tavilyApiKey } = await getAiClientForOrg(orgId);

  if (!tavilyApiKey) {
    throw new Error(
      usingCustomSettings
        ? "مزوّد الذكاء الاصطناعي المخصّص محتاج مفتاح Tavily للبحث الحقيقي — اضبطه من /admin/ai-settings قبل التحليل."
        : "محتاج تضبط مفتاح Tavily من /admin/ai-settings عشان التحليل يعتمد على بحث حقيقي حديث بدل معرفة الموديل العامة."
    );
  }

  const taskMessage = `ابحث عن المنافسين الحقيقيين لتصدير المنتج ده لسوق الدولة دي:

المنتج: ${product.nameAr} (${product.nameEn}) — HS Code: ${product.hsCode}، الفئة: ${product.category}، بلد المنشأ: ${product.originCountry}
${describeProductContext(product)}
السوق المستهدف: ${market.countryNameAr} (${market.countryNameEn}, ${market.countryCode}) — العملة المحلية: ${market.currency}
${describeMarketContext(market)}`;

  let rawResults: TavilySource[];
  try {
    rawResults = await multiTavilySearch(tavilyApiKey, [
      `${product.nameEn} exporting countries competitors ${market.countryNameEn} import 2026`,
      `${product.nameEn} export season harvest calendar top producing countries`,
      `${product.nameEn} export price per kg competitors ${market.countryNameEn}`,
    ]);
  } catch (e) {
    throw e instanceof Error ? e : new Error("حصل خطأ أثناء البحث الحقيقي عن المنافسين.");
  }

  const { accepted: searchResults, rejected } = await vetSources(
    client,
    models,
    `المنتج المستهدف: ${product.nameAr} (${product.nameEn}), HS Code ${product.hsCode}.\nالدولة المستهدفة: ${market.countryNameAr} (${market.countryNameEn}, ${market.countryCode}).`,
    rawResults
  );
  void rejected;

  if (searchResults.length === 0) {
    throw new Error(
      rawResults.length === 0
        ? "البحث الحقيقي عن منافسين لهذا المنتج/السوق مارجعش أي نتائج — التحليل اتلغى بدل ما يُبنى على تخمين."
        : `البحث رجّع ${rawResults.length} نتيجة لكن كل واحدة اتفرزت كغير ذات صلة كافية — التحليل اتلغى بدل ما يُبنى على مصادر ضعيفة.`
    );
  }

  let completion;
  try {
    ({ completion } = await chatCompletionWithModelFallback(client, models, {
      messages: [
        { role: "system", content: SYSTEM_PROMPT_TAVILY },
        { role: "user", content: `${taskMessage}\n\nنتائج بحث حقيقية حديثة، اتفرزت مسبقًا للصلة:\n\n${formatSourcesForPrompt(searchResults)}` },
      ],
    }));
  } catch (e) {
    throw new Error(describeOpenAiError(e, usingCustomSettings));
  }

  const text = completion.choices[0]?.message.content ?? "";
  const parsed = parseJsonBlock(text, AnalysisResultSchema);
  const sources = searchResults.map((s) => ({ title: s.title, url: s.url, publishedDate: s.publishedDate }));
  return parsed.competitors.map((c) => ({ ...c, sources }));
}
