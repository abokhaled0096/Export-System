import OpenAI from "openai";

/** بيبني سطر سياق من حقول Product اللي كانت متجاهَلة تمامًا في برومبت التحليل قبل 9 سبتمبر
 * (مواسم التوفّر، موسم الحصاد، مدة الصلاحية، حرارة التخزين) — رغم إنها موجودة فعليًا في الـschema
 * وقابلة للتعديل من /products/[id]. سطر فاضي لو المنتج لسه من غير أي بيانات منها. */
export function describeProductContext(p: {
  availableMonths: number[];
  harvestSeason: string | null;
  shelfLifeDays: number | null;
  storageTempC: unknown;
  requiresRefrigeration: boolean;
}): string {
  const parts: string[] = [];
  if (p.availableMonths.length > 0) parts.push(`مواسم توفّر المنتج عندنا (أرقام شهور 1-12): ${p.availableMonths.join("، ")}`);
  if (p.harvestSeason) parts.push(`موسم الحصاد: ${p.harvestSeason}`);
  if (p.shelfLifeDays !== null) parts.push(`مدة الصلاحية: ${p.shelfLifeDays} يوم`);
  if (p.storageTempC !== null && p.storageTempC !== undefined) parts.push(`حرارة التخزين المطلوبة: ${String(p.storageTempC)}°C`);
  if (p.requiresRefrigeration) parts.push("يحتاج تبريد أثناء النقل والتخزين");
  return parts.length > 0 ? `بيانات إضافية عن المنتج عندنا: ${parts.join("، ")}.` : "";
}

/** نفس فكرة describeProductContext لكن لحقول Market (اتفاقية التجارة، درجات المخاطرة المسجّلة،
 * الموانئ) — كانت متجاهَلة برضه رغم وجودها من صفحة /markets/[id]. */
export function describeMarketContext(m: {
  tradeAgreement: string | null;
  politicalRiskScore: number | null;
  logisticsRiskScore: number | null;
  mainPorts: string[];
}): string {
  const parts: string[] = [];
  if (m.tradeAgreement) parts.push(`اتفاقية التجارة المسجّلة معانا: ${m.tradeAgreement}`);
  if (m.politicalRiskScore !== null) parts.push(`درجة المخاطرة السياسية المسجّلة عندنا لهذه الدولة: ${m.politicalRiskScore}/100`);
  if (m.logisticsRiskScore !== null) parts.push(`درجة المخاطرة اللوجستية المسجّلة عندنا: ${m.logisticsRiskScore}/100`);
  if (m.mainPorts.length > 0) parts.push(`الموانئ الرئيسية: ${m.mainPorts.join("، ")}`);
  return parts.length > 0 ? `بيانات إضافية عن السوق عندنا: ${parts.join("، ")}.` : "";
}

/** بيصلّح رموز عربية بتتسرّب جوه بنية الـJSON نفسها (مش جوه نص الـstrings، ده سليم) وبتكسر
 * JSON.parse — اتلاحظ حيًا (9 سبتمبر) موديل بيكتب فاصلة عربية "،" بدل "," جوه array زي
 * "sourceRefs": [4، 10]، وأرقام عربية-هندية أحيانًا بدل أرقام ASCII. الاستبدال هنا global وآمن
 * حتى لو وقع جوه نص string (فاصلة عربية بدل إنجليزية جوه جملة مفيهاش أي فرق دلالي). */
function sanitizeModelJson(text: string): string {
  const arabicDigits: Record<string, string> = { "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4", "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9" };
  return text.replace(/،/g, ",").replace(/[٠-٩]/g, (d) => arabicDigits[d] ?? d);
}

/** بيستخرج آخر بلوك ```json من نص الرد ويتحقق منه بـZod schema مررت من برّه — كانت الدالة دي
 * مكرّرة بالحرف في analyzeMarket.ts وanalyzeCompetitors.ts (اتفصلت هنا 8 سبتمبر). */
export function parseJsonBlock<T>(text: string, schema: { safeParse: (v: unknown) => { success: boolean; data?: T; error?: { message: string } } }): T {
  const matches = [...text.matchAll(/```json\s*([\s\S]*?)```/g)];
  if (matches.length === 0) {
    throw new Error("رد الذكاء الاصطناعي ما فيهوش JSON بالصيغة المتوقعة.");
  }
  const lastMatch = sanitizeModelJson(matches[matches.length - 1][1]);
  let parsed: unknown;
  try {
    parsed = JSON.parse(lastMatch);
  } catch {
    throw new Error("رد الذكاء الاصطناعي فيه JSON غير صالح.");
  }
  const result = schema.safeParse(parsed);
  if (!result.success || result.data === undefined) {
    throw new Error("رد الذكاء الاصطناعي ما طابقش الصيغة المطلوبة: " + (result.error?.message ?? ""));
  }
  return result.data;
}

/** بيجمع مصادر البحث الحقيقية من url_citation annotations — مش من نص الرد (تفادي هلوسة روابط).
 * كانت مكرّرة بالحرف في الملفين برضه. */
export function extractSources(response: OpenAI.Responses.Response): { title: string; url: string }[] {
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

/** خطأ "سعة" — الموديل نفسه مش متاح دلوقتي (كوتة خلصت، ضغط، أو مابيردش)، مش خطأ في الطلب نفسه.
 * الحالات دي بس هي اللي تستاهل نجرّب موديل تاني بدلها؛ أي خطأ تاني (مفتاح غلط، طلب غير صالح)
 * هيتكرر بالظبط مع أي موديل فالتجربة فيه إهدار وقت. */
function isCapacityError(e: unknown): boolean {
  if (e instanceof OpenAI.RateLimitError) return true; // 429 — كوتة خلصت أو تزاحم
  if (e instanceof OpenAI.APIConnectionError) return true; // timeout/انقطاع اتصال
  if (e instanceof OpenAI.APIError && typeof e.status === "number" && e.status >= 500) return true;
  if (e instanceof OpenAI.NotFoundError) return true; // موديل اتشال من عند المزوّد
  return false;
}

/** بينفّذ chat.completions على أول موديل شغّال من القائمة — بيعدّي للي بعده لو الموديل الحالي
 * راجع خطأ سعة (راجع isCapacityError)، وبيرمي الخطأ زي ما هو لو المشكلة في الطلب نفسه.
 *
 * ليه: الموديلات المجانية (Gemini AI Studio تحديدًا) بيخلص كوتتها أو تتزحم فجأة، واتلاحظ حيًا
 * إن دفعة كاملة (12 تركيبة) فشلت 100% لأن الموديل المضبوط كانت كوتته خلصت — بينما موديلات تانية
 * على نفس المفتاح كانت شغّالة وبترد في ثانية ونص. موديل واحد مزحوم مايوقّفش الشغل كله. */
export async function chatCompletionWithModelFallback(
  client: OpenAI,
  models: string[],
  params: Omit<OpenAI.Chat.ChatCompletionCreateParamsNonStreaming, "model">
): Promise<{ completion: OpenAI.Chat.ChatCompletion; model: string }> {
  let lastError: unknown;
  for (const model of models) {
    try {
      return { completion: await client.chat.completions.create({ ...params, model }), model };
    } catch (e) {
      lastError = e;
      if (!isCapacityError(e)) throw e;
    }
  }
  throw lastError;
}

/** يحوّل أخطاء OpenAI API لرسائل عربية واضحة بدل JSON خام. usingCustomSettings بيفرّق الرسالة
 * لو الأدمن ضبط مزوّد/مفتاح مخصّص من /admin/ai-settings (بدل الإشارة لـ.env دايمًا). */
export function describeOpenAiError(e: unknown, usingCustomSettings: boolean): string {
  const settingsHint = usingCustomSettings
    ? "تأكد من صحة المفتاح/الـBase URL/الموديل من /admin/ai-settings."
    : "تأكد إن OPENAI_API_KEY منسوخ صح من platform.openai.com في ملف .env.";

  if (e instanceof OpenAI.AuthenticationError) {
    return `مفتاح الذكاء الاصطناعي غير صحيح — ${settingsHint}`;
  }
  if (e instanceof OpenAI.RateLimitError) {
    const message = e.message ?? "";
    if (message.toLowerCase().includes("quota")) {
      return `الحساب ده مفيهوش رصيد فعلي كفاية (insufficient_quota) — لازم تضيف وسيلة دفع/رصيد عند مزوّد الخدمة. رسالة الخطأ الكاملة: ${message}`;
    }
    return `تم تجاوز الحد المسموح من الطلبات مؤقتًا — حاول تاني بعد شوية. رسالة الخطأ الكاملة: ${message}`;
  }
  if (e instanceof OpenAI.BadRequestError) {
    return `طلب غير صالح لـAPI الذكاء الاصطناعي: ${e.message}`;
  }
  if (e instanceof OpenAI.APIError) {
    return `خطأ من API الذكاء الاصطناعي (${e.status}): ${e.message} — ${usingCustomSettings ? "لو ده مزوّد مخصّص، تأكد إنه بيدعم نفس صيغة OpenAI (chat/completions API)." : ""}`;
  }
  return e instanceof Error ? e.message : "حصل خطأ غير متوقع أثناء الاتصال بالذكاء الاصطناعي.";
}
