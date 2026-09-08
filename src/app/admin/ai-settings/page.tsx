import { requireCurrentUser } from "@/lib/session";
import { requirePermission } from "@/lib/permissions";
import { getScopedPrisma } from "@/lib/scoped-prisma";
import AiSettingsForm from "./AiSettingsForm";

export const dynamic = "force-dynamic";

export default async function AiSettingsPage() {
  const user = await requireCurrentUser();

  try {
    await requirePermission(user.roleId, "User", "Edit");
  } catch {
    return (
      <main className="mx-auto max-w-3xl px-6 py-10">
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-6 text-center text-sm text-rose-700">
          معندكش صلاحية الوصول للصفحة دي — إعدادات الذكاء الاصطناعي متاحة لـAdmin/CompanyOwner بس.
        </div>
      </main>
    );
  }

  const scopedPrisma = await getScopedPrisma();
  const org = await scopedPrisma.organization.findUniqueOrThrow({
    where: { id: user.orgId },
    select: { aiApiKeySecretId: true, aiBaseUrl: true, aiModel: true, tavilyApiKeySecretId: true },
  });

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-2xl font-semibold text-foreground">إعدادات الذكاء الاصطناعي</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        مفتاح الـAPI والموديل المستخدمين في تحليلات السوق/المنافسين الآلية (`/analysis/ai/new`،
        `/competitors/ai/new`). سيبهم فاضيين لو عايز تستخدم إعدادات .env الافتراضية.
      </p>
      <p className="mt-2 rounded-lg bg-sky-50 px-3 py-2 text-xs text-sky-800">
        غيّر Base URL + المفتاح + الموديل عشان تستخدم أي مزوّد ذكاء اصطناعي بيدعم نفس صيغة OpenAI
        (chat/responses API) — أغلب الموديلات الحديثة (مباشرة أو عبر مجمّعات زي OpenRouter) هتشتغل
        تلقائيًا بلا أي تعديل كود. لو المزوّد مش بيدعم نفس الصيغة، هيظهر خطأ واضح وقت أول تحليل بدل
        فشل صامت.
      </p>
      <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
        مزوّدين كتير بيقبلوا أداة البحث شكليًا لكن بيرجّعوا نتيجة &quot;بحث&quot; وهمية بلا أي تحذير — اتأكدنا
        من ده فعليًا مع موديل خارجي جُرّب. عشان كده، لو هتستخدم موديل غير OpenAI، **لازم** كمان تسجّل
        مفتاح Tavily (خدمة بحث حقيقي مستقلة، تحت) — بلاه، أي تحليل هيرفض يشتغل بدل ما يرجّع نتيجة
        مبنية على بحث وهمي.
      </p>

      <div className="mt-6">
        <AiSettingsForm
          hasCustomApiKey={Boolean(org.aiApiKeySecretId)}
          currentBaseUrl={org.aiBaseUrl}
          currentModel={org.aiModel}
          hasTavilyKey={Boolean(org.tavilyApiKeySecretId)}
        />
      </div>
    </main>
  );
}
