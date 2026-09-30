"use client";

import { useActionState, useState } from "react";
import { updateAccountingSettingsAction, type AccountingSettingsFormState } from "./actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import CurrencySelect from "@/components/CurrencySelect";

const initialState: AccountingSettingsFormState = {};

export default function AccountingSettingsForm({ currentFunctionalCurrency }: { currentFunctionalCurrency: string | null }) {
  const [editing, setEditing] = useState(false);
  const [state, formAction, pending] = useActionState(updateAccountingSettingsAction, initialState);

  const [prevState, setPrevState] = useState(state);
  if (state !== prevState) {
    setPrevState(state);
    if (state.success) setEditing(false);
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="text-foreground/80">العملة الوظيفية: {currentFunctionalCurrency || "— محاسبة عملة واحدة (الافتراضي)"}</span>
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
            <Label htmlFor="functionalCurrency">العملة الوظيفية (فاضية = إلغاء التفعيل)</Label>
            <CurrencySelect id="functionalCurrency" name="functionalCurrency" defaultValue={currentFunctionalCurrency ?? "EGP"} className="w-44" />
            {state.errors?.functionalCurrency && <span className="text-xs text-destructive">{state.errors.functionalCurrency[0]}</span>}
          </div>
          <Button type="submit" disabled={pending}>
            {pending ? "جاري الحفظ..." : "حفظ"}
          </Button>
          <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
            إلغاء
          </Button>
          {state.mfaRequired && <span className="w-full text-xs text-amber-700">فعّل MFA من إعدادات حسابك الأول.</span>}
          {state.formError && <p className="w-full text-sm text-destructive">{state.formError}</p>}
        </form>
      )}
    </div>
  );
}
