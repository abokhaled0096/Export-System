import OpenAI from "openai";

/** بيستخرج آخر بلوك ```json من نص الرد ويتحقق منه بـZod schema مررت من برّه — كانت الدالة دي
 * مكرّرة بالحرف في analyzeMarket.ts وanalyzeCompetitors.ts (اتفصلت هنا 8 سبتمبر). */
export function parseJsonBlock<T>(text: string, schema: { safeParse: (v: unknown) => { success: boolean; data?: T; error?: { message: string } } }): T {
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
