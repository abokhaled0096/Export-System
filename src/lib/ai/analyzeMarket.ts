import { z } from "zod";
import { getAiClientForOrg } from "./client";
import { parseJsonBlock, describeOpenAiError, chatCompletionWithModelFallback, describeProductContext, describeMarketContext } from "./openaiHelpers";
import { multiTavilySearch, formatSourcesForPrompt, type TavilySource } from "./tavilySearch";
import { vetSources } from "./sourceVetting";

/** كل ادعاء قابل للتحقق لازم مصدر — رقم المصدر هو نفس رقم [n] اللي ظهر في formatSourcesForPrompt
 * (raqm 1-based). sourceRefs مش .min(1) هنا عمدًا: اتلاحظ حيًا إن الموديل أحيانًا بينسى مرجع بند
 * واحد وسط رد طويل غني — رفض الرد كله بسبب بند واحد ناقص إهدار لتحليل صحيح غالبًا. بدل كده،
 * البند اللي من غير مرجع (لا في sourceRefs ولا [n] جوه النص) بيتشال بعد الـparsing (filterCitedItems
 * تحت)، مش الرد كله. */
const citedText = z.object({
  text: z.string().min(3),
  sourceRefs: z.array(z.number().int().min(1)),
});

const CITATION_PATTERN = /\[\d+\]/;

function hasCitation(item: z.infer<typeof citedText>): boolean {
  return item.sourceRefs.length > 0 || CITATION_PATTERN.test(item.text);
}

/** بيشيل أي بند من demandDrivers/keyRisks من غير مرجع مصدر حقيقي (لا sourceRefs ولا [n] جوه
 * النص) بدل ما يرفض التحليل كله — نفس مبدأ "ممنوع ادعاء بلا مصدر"، بس على مستوى البند مش الرد
 * كله. لو النتيجة فاضية بالكامل بعد الفلترة، برضه مقبول (array فاضي أحسن من ادعاء مخترع). */
function filterCitedItems(items: z.infer<typeof citedText>[]): z.infer<typeof citedText>[] {
  return items.filter(hasCitation);
}

const PriceEstimateSchema = z
  .object({
    min: z.number().nullable(),
    max: z.number().nullable(),
    currency: z.string().length(3),
    sourceRefs: z.array(z.number().int().min(1)),
  })
  .nullable();

const AnalysisResultSchema = z.object({
  opportunityScore: z.number().int().min(0).max(100),
  riskScore: z.number().int().min(0).max(100),
  confidenceLevel: z.number().int().min(0).max(100),
  recommendation: z.enum(["Start", "Study", "Monitor", "Avoid"]),
  reasoning: z.string().min(20).refine((v) => CITATION_PATTERN.test(v), "reasoning لازم يحتوي على مرجع مصدر [n] واحد على الأقل"),
  marketOverview: z.string().min(20).refine((v) => CITATION_PATTERN.test(v), "marketOverview لازم يحتوي على مرجع مصدر [n] واحد على الأقل"),
  demandDrivers: z.array(citedText).max(8),
  keyRisks: z.array(citedText).max(8),
  regulatoryNotes: z.string().min(10).refine((v) => CITATION_PATTERN.test(v), "regulatoryNotes لازم يحتوي على مرجع مصدر [n] واحد على الأقل"),
  priceEstimate: PriceEstimateSchema,
  recommendedNextSteps: z.array(z.string().min(3)).max(8),
});

export type AiMarketAnalysis = z.infer<typeof AnalysisResultSchema> & {
  sources: { title: string; url: string; publishedDate: string | null }[];
  rejectedSourcesCount: number;
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

const JSON_INSTRUCTIONS = `في آخر ردك، وبعد ما تخلص تحليل، اكتب فقرة قصيرة توضح فيها أهم أسباب تقييمك (بالعربي)، وبعدها ضع بلوك JSON واحد بالضبط بالشكل ده بالظبط (بلا أي نص زيادة جواه):

\`\`\`json
{
  "opportunityScore": <رقم من 0 إلى 100>,
  "riskScore": <رقم من 0 إلى 100>,
  "confidenceLevel": <رقم من 0 إلى 100 — مدى ثقتك في التقييم ده بناءً على جودة المعلومات اللي لقيتها>,
  "recommendation": "<Start أو Study أو Monitor أو Avoid>",
  "reasoning": "<فقرة عربية واضحة تشرح سبب الدرجات والتوصية، وتحتوي على الأقل مرجع مصدر واحد بالشكل [1] أو [2] جوه النص نفسه عند أي ادعاء رقمي أو واقعي>",
  "marketOverview": "<فقرة عربية عن حجم السوق ومعدل نموه واتجاهه العام، بمراجع [n] جوه النص>",
  "demandDrivers": [{"text": "<سبب طلب حقيقي>", "sourceRefs": [<أرقام المصادر اللي أكّدت الجملة دي، زي [1] أو [1,3]>]}],
  "keyRisks": [{"text": "<خطر حقيقي>", "sourceRefs": [<أرقام المصادر>]}],
  "regulatoryNotes": "<لوائح استيراد/تعريفات جمركية/شهادات مطلوبة لهذا المنتج في هذه الدولة تحديدًا، بمراجع [n] جوه النص>",
  "priceEstimate": {"min": <رقم أو null>, "max": <رقم أو null>, "currency": "<كود عملة ISO 4217>", "sourceRefs": [<أرقام المصادر>]} أو null لو مفيش بيانات سعر حقيقية،
  "recommendedNextSteps": ["<خطوة عملية موصى بها 1>", "<خطوة عملية موصى بها 2>", "..."]
}
\`\`\`

القاعدة الأهم: **أي جملة أو رقم مالوش مرجع [n] لمصدر حقيقي من المصادر المرفقة غير مقبول إطلاقًا** — لو معلومة معيّنة (زي السعر) مش متوفرة فعليًا في المصادر، سيبها null/فاضية بدل ما تخترعها أو تنسبها لمصدر غلط. recommendedNextSteps استثناء (توصيات عملية منك، مش ادعاءات واقعية، فمالهاش مراجع).

مهم جدًا لصحة الـJSON: جوه بنية الـJSON نفسها (الأقواس، الفواصل بين عناصر array، الأرقام) استخدم فاصلة إنجليزية "," وأرقام إنجليزية بس (زي [4, 10] مش [٤، ١٠]) — الفاصلة العربية "،" مسموحة جوه نصوص الجمل بس.`;

const SYSTEM_PROMPT_TAVILY = `أنت محلل أسواق تصدير خبير. مهمتك تحليل فرصة تصدير منتج مصري لسوق دولة معيّنة، بالاعتماد **حصريًا** على نتائج البحث الحقيقية المرفقة في رسالة المستخدم تحت (أسعار، منافسين، لوائح استيراد، اتفاقيات تجارية، طلب فعلي) — ممنوع تختراع أو تفترض معلومة مش موجودة في النتائج المرفقة؛ لو المعلومة ناقصة، قول كده صراحة في الحقل المناسب (نص يوضح النقص، أو null للأرقام) وقلّل confidenceLevel.

المصادر دي **اتفرزت مسبقًا** وكل واحد فيها متأكَّد إنه عن نفس المنتج ونفس الدولة تحديدًا — لكن لسه لازم كل ادعاء في ردك يحمل رقم مرجع [n] واضح لمصدره.

${JSON_INSTRUCTIONS}`;

export async function analyzeMarketWithAI(product: ProductInput, market: MarketInput, orgId: string): Promise<AiMarketAnalysis> {
  const { client, models, usingCustomSettings, tavilyApiKey } = await getAiClientForOrg(orgId);

  if (!tavilyApiKey) {
    throw new Error(
      usingCustomSettings
        ? "مزوّد الذكاء الاصطناعي المخصّص محتاج مفتاح Tavily للبحث الحقيقي — اضبطه من /admin/ai-settings قبل التحليل."
        : "محتاج تضبط مفتاح Tavily من /admin/ai-settings عشان التحليل يعتمد على بحث حقيقي حديث بدل معرفة الموديل العامة."
    );
  }

  const taskMessage = `حلل فرصة تصدير المنتج ده لسوق الدولة دي:

المنتج: ${product.nameAr} (${product.nameEn}) — HS Code: ${product.hsCode}، الفئة: ${product.category}، بلد المنشأ: ${product.originCountry}
${describeProductContext(product)}
السوق المستهدف: ${market.countryNameAr} (${market.countryNameEn}, ${market.countryCode}) — العملة المحلية: ${market.currency}
${describeMarketContext(market)}`;

  let rawResults: TavilySource[];
  try {
    rawResults = await multiTavilySearch(tavilyApiKey, [
      `${product.nameEn} demand market size growth ${market.countryNameEn} 2026`,
      `${product.nameEn} import regulations tariffs certification requirements ${market.countryNameEn}`,
      `${product.nameEn} export price competition ${market.countryNameEn} 2026`,
    ]);
  } catch (e) {
    throw e instanceof Error ? e : new Error("حصل خطأ أثناء البحث الحقيقي عن السوق.");
  }

  const { accepted: searchResults, rejected } = await vetSources(
    client,
    models,
    `المنتج المستهدف: ${product.nameAr} (${product.nameEn}), HS Code ${product.hsCode}.\nالدولة المستهدفة: ${market.countryNameAr} (${market.countryNameEn}, ${market.countryCode}).`,
    rawResults
  );

  // فشل واضح أحسن من تحليل مبني على تخمين — لو الفرز رفض كل المصادر (أو البحث رجّع صفر من
  // الأساس)، مفيش أساس حقيقي نبني عليه التحليل، فالتركيبة دي تفشل بدل ما تتحلّل على معرفة عامة.
  if (searchResults.length === 0) {
    throw new Error(
      rawResults.length === 0
        ? "البحث الحقيقي عن هذا المنتج/السوق مارجعش أي نتائج — التحليل اتلغى بدل ما يُبنى على تخمين."
        : `البحث رجّع ${rawResults.length} نتيجة لكن كل واحدة اتفرزت كغير ذات صلة كافية (منتج/دولة مختلفة أو محتوى قديم) — التحليل اتلغى بدل ما يُبنى على مصادر ضعيفة.`
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
  return {
    ...parsed,
    demandDrivers: filterCitedItems(parsed.demandDrivers),
    keyRisks: filterCitedItems(parsed.keyRisks),
    // سعر بلا مرجع مصدر = بالظبط الخطر اللي البوابة دي مبنية عشان تمنعه — نسيبه فاضي بدل ما
    // نعرض رقم مخترع، مش نرفض التحليل كله عشانه.
    priceEstimate: parsed.priceEstimate && parsed.priceEstimate.sourceRefs.length > 0 ? parsed.priceEstimate : null,
    sources: searchResults.map((s) => ({ title: s.title, url: s.url, publishedDate: s.publishedDate })),
    rejectedSourcesCount: rejected.length,
  };
}
