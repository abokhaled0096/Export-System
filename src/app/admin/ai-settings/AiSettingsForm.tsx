"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import {
  updateAiSettingsAction,
  clearAiApiKeyAction,
  clearTavilyApiKeyAction,
  type AiSettingsFormState,
  type ClearAiKeyState,
} from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const updateInitialState: AiSettingsFormState = {};
const clearInitialState: ClearAiKeyState = {};

/** بلا عرض المفتاح نفسه أبدًا — بادج "مسجّل" بس (نفس فلسفة SupplierBankInfoForm). Base URL
 * والموديل مش أسرار، بيتعرضوا عاديين. */
export default function AiSettingsForm({
  hasCustomApiKey,
  currentBaseUrl,
  currentModel,
  hasTavilyKey,
}: {
  hasCustomApiKey: boolean;
  currentBaseUrl: string | null;
  currentModel: string | null;
  hasTavilyKey: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [state, formAction, pending] = useActionState(updateAiSettingsAction, updateInitialState);
  const [clearState, clearAction, clearPending] = useActionState(clearAiApiKeyAction, clearInitialState);
  const [clearTavilyState, clearTavilyAction, clearTavilyPending] = useActionState(clearTavilyApiKeyAction, clearInitialState);

  const [prevState, setPrevState] = useState(state);
  if (state !== prevState) {
    setPrevState(state);
    if (state.success) setEditing(false);
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="text-foreground/80">مفتاح API: {hasCustomApiKey ? "🔒 مخصّص مسجَّل" : "— بيستخدم OPENAI_API_KEY من .env"}</span>
        <span className="text-foreground/80">Base URL: {currentBaseUrl || "الافتراضي (OpenAI)"}</span>
        <span className="text-foreground/80">الموديل: {currentModel || "الافتراضي (gpt-4o-mini)"}</span>
        <span className="text-foreground/80">Tavily (بحث حقيقي): {hasTavilyKey ? "🔒 مسجّل" : "غير مضبوط"}</span>
        {!editing && (
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
            تعديل
          </Button>
        )}
        {state.success && <span className="text-xs text-emerald-700">اتحفظ بنجاح ✓</span>}
      </div>

      {editing && (
        <form action={formAction} className="flex flex-wrap items-end gap-3 border-t border-border pt-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ai-api-key" className="text-xs">
              مفتاح API جديد
            </Label>
            <Input
              id="ai-api-key"
              name="apiKey"
              type="password"
              placeholder={hasCustomApiKey ? "🔒 مسجّل — سيب فاضي عشان تسيبه زي ما هو" : "sk-..."}
              className="w-64 font-mono"
              dir="ltr"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ai-base-url" className="text-xs">
              Base URL
            </Label>
            <Input
              id="ai-base-url"
              name="baseUrl"
              defaultValue={currentBaseUrl ?? ""}
              placeholder="افتراضي (https://api.openai.com/v1)"
              className="w-64 font-mono"
              dir="ltr"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ai-model" className="text-xs">
              الموديل (أو أكتر من واحد بفاصلة — الأول أساسي والباقي احتياطي)
            </Label>
            <Input id="ai-model" name="model" defaultValue={currentModel ?? ""} placeholder="افتراضي (gpt-4o-mini)" className="w-96 font-mono" dir="ltr" />
            <span className="text-[11px] text-muted-foreground">
              لو الموديل الأساسي كوتته خلصت أو مزحوم، النظام بيجرّب اللي بعده تلقائيًا بدل ما يفشل التحليل.
            </span>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tavily-api-key" className="text-xs">
              مفتاح Tavily للبحث الحقيقي
            </Label>
            <Input
              id="tavily-api-key"
              name="tavilyApiKey"
              type="password"
              placeholder={hasTavilyKey ? "🔒 مسجّل — سيب فاضي عشان تسيبه زي ما هو" : "tvly-..."}
              className="w-64 font-mono"
              dir="ltr"
            />
          </div>
          <Button type="submit" disabled={pending}>
            {pending ? "جاري الحفظ..." : "حفظ"}
          </Button>
          <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
            إلغاء
          </Button>
          {state.formError && (
            <p role="alert" className="w-full text-sm text-destructive">
              {state.formError}
              {state.mfaRequired && (
                <>
                  {" "}
                  <Link href="/mfa/challenge?next=/admin/ai-settings" className="underline">
                    تحقق دلوقتي
                  </Link>
                </>
              )}
            </p>
          )}
        </form>
      )}

      {hasCustomApiKey && (
        <form action={clearAction} className="flex items-center gap-3 border-t border-border pt-3">
          <Button type="submit" variant="outline" size="sm" disabled={clearPending}>
            {clearPending ? "جاري المسح..." : "امسح المفتاح المخصّص وارجع لـ.env"}
          </Button>
          {clearState.success && <span className="text-xs text-emerald-700">اتمسح بنجاح ✓</span>}
          {clearState.formError && (
            <p role="alert" className="text-sm text-destructive">
              {clearState.formError}
              {clearState.mfaRequired && (
                <>
                  {" "}
                  <Link href="/mfa/challenge?next=/admin/ai-settings" className="underline">
                    تحقق دلوقتي
                  </Link>
                </>
              )}
            </p>
          )}
        </form>
      )}

      {hasTavilyKey && (
        <form action={clearTavilyAction} className="flex items-center gap-3 border-t border-border pt-3">
          <Button type="submit" variant="outline" size="sm" disabled={clearTavilyPending}>
            {clearTavilyPending ? "جاري المسح..." : "امسح مفتاح Tavily"}
          </Button>
          {clearTavilyState.success && <span className="text-xs text-emerald-700">اتمسح بنجاح ✓</span>}
          {clearTavilyState.formError && (
            <p role="alert" className="text-sm text-destructive">
              {clearTavilyState.formError}
              {clearTavilyState.mfaRequired && (
                <>
                  {" "}
                  <Link href="/mfa/challenge?next=/admin/ai-settings" className="underline">
                    تحقق دلوقتي
                  </Link>
                </>
              )}
            </p>
          )}
        </form>
      )}
    </div>
  );
}
