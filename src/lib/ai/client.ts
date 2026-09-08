import OpenAI from "openai";
import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/vault";

const DEFAULT_MODEL = "gpt-4o-mini";

/** بيجهّز عميل الذكاء الاصطناعي والموديل للمنظمة الحالية — بيقرا الإعدادات المخصّصة من
 * Organization لو الأدمن ضبطها من /admin/ai-settings (مفتاح مشفّر عبر Vault + Base URL
 * + اسم موديل)، وإلا بيرجع لـOPENAI_API_KEY من .env والموديل الافتراضي (توافق خلفي كامل).
 *
 * orgId بارامتر صريح مش من session — نفس نمط دوال src/lib/accounting.ts، الاستدعاء بيتم من
 * Server Action عمل requireCurrentUser() بالفعل، وده خط الدفاع.
 *
 * تغيير الـBase URL يشتغل تلقائي مع أي مزوّد بيدعم صيغة OpenAI (chat/responses API) — أغلب
 * الموديلات الحديثة (مباشرة أو عبر مجمّعات زي OpenRouter) — بلا أي تعديل كود. مزوّد بصيغة
 * مختلفة تمامًا هيرجع خطأ واضح وقت أول استدعاء (راجع describeOpenAiError في openaiHelpers.ts)،
 * مش فشل صامت. */
export async function getAiClientForOrg(orgId: string): Promise<{ client: OpenAI; model: string; usingCustomSettings: boolean }> {
  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: orgId },
    select: { aiApiKeySecretId: true, aiBaseUrl: true, aiModel: true },
  });

  const apiKey = org.aiApiKeySecretId ? await decryptSecret(org.aiApiKeySecretId) : process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("محتاج تضبط مفتاح API للذكاء الاصطناعي — من /admin/ai-settings أو OPENAI_API_KEY في .env.");
  }

  return {
    client: new OpenAI({ apiKey, baseURL: org.aiBaseUrl || undefined }),
    model: org.aiModel || DEFAULT_MODEL,
    usingCustomSettings: Boolean(org.aiApiKeySecretId),
  };
}
