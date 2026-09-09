import type OpenAI from "openai";
import { z } from "zod";
import { chatCompletionWithModelFallback, parseJsonBlock, describeOpenAiError } from "./openaiHelpers";
import type { TavilySource } from "./tavilySearch";

const VerdictSchema = z.object({
  index: z.number().int(),
  relevant: z.boolean(),
  reason: z.string().min(3),
});

const VettingResultSchema = z.object({ verdicts: z.array(VerdictSchema) });

const JSON_INSTRUCTIONS = `ضع بلوك JSON واحد بالضبط بالشكل ده (بلا أي نص زيادة جواه، حتى بلا فقرة تمهيدية):

\`\`\`json
{
  "verdicts": [
    {"index": <رقم المصدر زي ما ظهر بين []>, "relevant": <true أو false>, "reason": "<سبب قصير بالعربي>"}
  ]
}
\`\`\`

لازم verdict واحد لكل مصدر ظهر، بنفس الترتيب.`;

/** بوابة فرز — نداء موديل منفصل *قبل* التحليل الفعلي، بيقيّم كل مصدر بحث لوحده على 3 معايير
 * صارمة: (1) عن نفس المنتج بالظبط، مش منتج قريب أو بديل (فراولة مجففة ≠ فراولة مجمدة)، (2)
 * عن استيراد/تجارة تجارية حقيقية لنفس الدولة المستهدفة، مش سفر أفراد ولا دولة تانية، (3) محتواه
 * نفسه (مش بس تاريخ نشره) لا يبدو قديمًا لدرجة ما يعودش يعكس الوضع الحالي (لوائح/أسعار اتغيّرت).
 *
 * ليه نداء منفصل مش جزء من برومبت التحليل: اتلاحظ حيًا (9 سبتمبر) إن موديل واحد بيقيّم ويكتب
 * تحليل غني في نفس الوقت بيمرّر مصادر خارج الموضوع تمامًا (تقرير عن فراولة مجففة، صفحة جمارك
 * لسفر الأفراد) من غير ما يلاحظ — الانتباه للـ"صلة" بيضيع وسط مهمة الكتابة الأكبر. فصل المهمة
 * لنداء مخصّص وبسيط بيخلّي الفرز أدق، رغم إنه بيضاعف عدد النداءات لكل تركيبة تقريبًا (قرار واعٍ:
 * الجودة أهم من التكلفة هنا). التكلفة اتقلّلت جزئيًا بـmax_tokens محدود ونص مصدر مختصر بس. */
export async function vetSources(
  client: OpenAI,
  models: string[],
  contextDescription: string,
  sources: TavilySource[]
): Promise<{ accepted: TavilySource[]; rejected: { source: TavilySource; reason: string }[] }> {
  if (sources.length === 0) return { accepted: [], rejected: [] };

  const sourcesText = sources
    .map((s, i) => `[${i + 1}] ${s.title}${s.publishedDate ? ` (تاريخ النشر: ${s.publishedDate})` : " (تاريخ النشر غير معروف)"}\nمقتطف: ${s.content.slice(0, 400)}`)
    .join("\n\n");

  const systemPrompt = `أنت مراجع دقّة صارم لمصادر بحث قبل ما تُستخدم في قرار تصدير تجاري حقيقي. مهمتك الوحيدة إنك تفرز كل مصدر: هل هو عن نفس المنتج بالضبط ونفس الدولة المستهدفة تحديدًا، وهل محتواه لسه يعكس وضع حالي معقول (مش قديم جدًا أو عن سياق مختلف تمامًا زي سفر أفراد بدل تجارة استيراد)؟ كن صارم — مصدر عن منتج قريب أو بديل (زي "مجفف" بدل "مجمد") **مش** relevant حتى لو الاسم شبه.`;

  const userPrompt = `${contextDescription}

المصادر:
${sourcesText}

${JSON_INSTRUCTIONS}`;

  let completion;
  try {
    // رسالة system بس (بلا user) بترفضها بعض المزوّدين (اتلاحظ حيًا: Gemini عبر endpoint
    // OpenAI-compat برجّع 400 "contents is not specified") — لازم user turn حقيقي دايمًا.
    ({ completion } = await chatCompletionWithModelFallback(client, models, {
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 2000,
    }));
  } catch (e) {
    // فشل بوابة الفرز نفسها (مش رفض مصادر) — نرمي بنفس رسائل الخطأ المعتادة، الطبقة اللي فوق
    // هتتعامل معاه زي أي فشل تاني في التحليل (التركيبة تتسجّل Failed، مش تعدّي بمصادر بلا فرز).
    throw new Error(describeOpenAiError(e, false));
  }

  const text = completion.choices[0]?.message.content ?? "";
  const parsed = parseJsonBlock(text, VettingResultSchema);

  const accepted: TavilySource[] = [];
  const rejected: { source: TavilySource; reason: string }[] = [];
  for (const v of parsed.verdicts) {
    const source = sources[v.index - 1];
    if (!source) continue;
    if (v.relevant) accepted.push(source);
    else rejected.push({ source, reason: v.reason });
  }

  return { accepted, rejected };
}
