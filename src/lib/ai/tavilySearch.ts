export type TavilySource = { title: string; url: string; content: string; publishedDate: string | null; score: number };

/** بحث حقيقي عبر Tavily (https://tavily.com) — مستقل تمامًا عن موديل الذكاء الاصطناعي، عشان نضمن
 * إن أي موديل (حتى اللي بيدّعي بحث ذاتي وبيرجع نتيجة وهمية) بيتحلّل على أساس نتائج حقيقية فعليًا.
 * search_depth: "basic" (1 credit) بدل "advanced" (2 credits) — أقصى استفادة من الحد المجاني الشهري.
 * time_range: "year" افتراضيًا — اتلاحظ حيًا مصدر من 2009 دخل تحليل حقيقي (تقرير USDA قديم عن
 * لوائح اتغيّرت مرات من ساعتها)، فلازم فلترة زمنية من عند Tavily نفسه مش نعتمد على تمييز الموديل. */
export async function tavilySearch(apiKey: string, query: string, maxResults = 6, timeRange: "day" | "week" | "month" | "year" = "year"): Promise<TavilySource[]> {
  let res: Response;
  try {
    res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_key: apiKey, query, max_results: maxResults, search_depth: "basic", time_range: timeRange, include_raw_content: false }),
    });
  } catch {
    throw new Error("تعذّر الاتصال بخدمة البحث (Tavily) — تأكد من الاتصال بالإنترنت وحاول تاني.");
  }

  if (!res.ok) {
    throw new Error(describeTavilyError(res.status, await res.text().catch(() => "")));
  }

  const data = (await res.json()) as { results?: { title: string; url: string; content: string; published_date?: string | null; score?: number }[] };
  return (data.results ?? []).map((r) => ({ title: r.title, url: r.url, content: r.content, publishedDate: r.published_date ?? null, score: r.score ?? 0 }));
}

/** بحث أعمق — عدة استعلامات مركّزة بالتوازي بدل استعلام واحد سطحي، بطلب صريح من المستخدم بعد
 * ما شاف نتيجة تحليل حقيقية لكن سطحية. النتائج بتتجمّع وتتشال منها التكرارات (بنفس الرابط) —
 * لو استعلامين رجّعوا نفس المصدر، بيتحسب مرة واحدة بس. التكلفة: اعتماد Tavily واحد لكل استعلام. */
export async function multiTavilySearch(apiKey: string, queries: string[], maxResultsPerQuery = 5): Promise<TavilySource[]> {
  const results = await Promise.all(queries.map((q) => tavilySearch(apiKey, q, maxResultsPerQuery)));
  const seen = new Set<string>();
  return results.flat().filter((s) => (seen.has(s.url) ? false : (seen.add(s.url), true)));
}

/** بيجهّز نتائج Tavily كنص سياق مرقّم يتحط في رسالة المستخدم للموديل — رقم كل مصدر هو نفسه
 * اللي المفروض الموديل يرجّعه في sourceRefs (راجع analyzeMarket.ts/analyzeCompetitors.ts).
 * لا fallback لـ"قيّم من معرفتك العامة" هنا عمدًا — لو مفيش مصادر، الطبقة اللي بتنادي الدالة دي
 * لازم ترفض تكمل بدل ما تسيب الموديل يخمّن بصمت (نفس فلسفة "فشل واضح أحسن من رقم مخترع"). */
export function formatSourcesForPrompt(sources: TavilySource[]): string {
  return sources
    .map((s, i) => `[${i + 1}] ${s.title}${s.publishedDate ? ` (تاريخ النشر: ${s.publishedDate})` : " (تاريخ النشر غير معروف)"}\nالرابط: ${s.url}\nمقتطف: ${s.content}`)
    .join("\n\n");
}

function describeTavilyError(status: number, body: string): string {
  if (status === 401 || status === 403) {
    return "مفتاح Tavily غير صحيح — تأكد منه في /admin/ai-settings.";
  }
  if (status === 429) {
    return "تم تجاوز الحد المسموح من طلبات البحث (Tavily) مؤقتًا — حاول تاني بعد شوية أو راجع رصيدك على tavily.com.";
  }
  return `خطأ من خدمة البحث (Tavily) — كود ${status}: ${body.slice(0, 200)}`;
}
