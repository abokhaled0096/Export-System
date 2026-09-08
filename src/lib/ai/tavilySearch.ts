export type TavilySource = { title: string; url: string; content: string };

/** بحث حقيقي عبر Tavily (https://tavily.com) — مستقل تمامًا عن موديل الذكاء الاصطناعي، عشان نضمن
 * إن أي موديل (حتى اللي بيدّعي بحث ذاتي وبيرجع نتيجة وهمية) بيتحلّل على أساس نتائج حقيقية فعليًا.
 * search_depth: "basic" (1 credit) بدل "advanced" (2 credits) — أقصى استفادة من الحد المجاني الشهري. */
export async function tavilySearch(apiKey: string, query: string, maxResults = 6): Promise<TavilySource[]> {
  let res: Response;
  try {
    res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_key: apiKey, query, max_results: maxResults, search_depth: "basic" }),
    });
  } catch {
    throw new Error("تعذّر الاتصال بخدمة البحث (Tavily) — تأكد من الاتصال بالإنترنت وحاول تاني.");
  }

  if (!res.ok) {
    throw new Error(describeTavilyError(res.status, await res.text().catch(() => "")));
  }

  const data = (await res.json()) as { results?: { title: string; url: string; content: string }[] };
  return (data.results ?? []).map((r) => ({ title: r.title, url: r.url, content: r.content }));
}

/** بيجهّز نتائج Tavily كنص سياق مرقّم يتحط في رسالة المستخدم للموديل. */
export function formatSourcesForPrompt(sources: TavilySource[]): string {
  if (sources.length === 0) return "(مفيش نتائج بحث — قيّم بناءً على معرفتك العامة وقول ده صراحة في التبرير)";
  return sources.map((s, i) => `[${i + 1}] ${s.title}\nالرابط: ${s.url}\nمقتطف: ${s.content}`).join("\n\n");
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
