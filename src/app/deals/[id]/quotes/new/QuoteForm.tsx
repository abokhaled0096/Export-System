"use client";

import { useActionState } from "react";
import { createQuote, type QuoteFormState } from "../../../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: QuoteFormState = {};

export default function QuoteForm({
  scenarioId,
  currency,
  walkAwayPrice,
}: {
  scenarioId: string;
  currency: string;
  /** null = المستخدم مالوش صلاحية يشوف بيانات التسعير الداخلية (راجع صفحة الأب) — الفورم
   * بيقبل السعر عادي برضه، الـTrigger على مستوى القاعدة هو اللي بيتحقق فعليًا. */
  walkAwayPrice: string | null;
}) {
  const action = createQuote.bind(null, scenarioId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex max-w-lg flex-col gap-5">
      {walkAwayPrice !== null && (
        <p className="text-sm text-muted-foreground">
          الحد الأدنى المسموح لهذا السيناريو:{" "}
          <span className="font-mono font-medium text-rose-700">
            {walkAwayPrice} {currency}
          </span>
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="unitPrice">سعر الوحدة ({currency}) *</Label>
          <Input id="unitPrice" name="unitPrice" type="number" step="0.0001" />
          {state.errors?.unitPrice && <span className="text-xs text-destructive">{state.errors.unitPrice[0]}</span>}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="priceUnit">وحدة السعر *</Label>
          <Input id="priceUnit" name="priceUnit" placeholder="kg" />
          {state.errors?.priceUnit && <span className="text-xs text-destructive">{state.errors.priceUnit[0]}</span>}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="validUntil">صالح حتى</Label>
        <Input id="validUntil" name="validUntil" type="date" className="w-fit" />
      </div>

      {state.formError && (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.formError}</p>
      )}

      <Button type="submit" disabled={pending} className="w-fit">
        {pending ? "جاري الحفظ..." : "إنشاء عرض السعر"}
      </Button>
    </form>
  );
}
