"use client";

import { useActionState } from "react";
import { createAiAnalysis, type AiAnalysisFormState } from "../../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form } from "@/components/ui/form";

const initialState: AiAnalysisFormState = {};

type Option = { id: string; label: string };

export default function AiAnalysisForm({
  products,
  markets,
}: {
  products: Option[];
  markets: Option[];
}) {
  const [state, formAction, pending] = useActionState(createAiAnalysis, initialState);

  return (
    <Form action={formAction} state={state} className="flex max-w-xl flex-col gap-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="productId">المنتج *</Label>
          <Select name="productId">
            <SelectTrigger id="productId" className="w-full">
              <SelectValue placeholder="اختر منتج">
                {(value: string | null) =>
                  value ? (products.find((p) => p.id === value)?.label ?? value) : "اختر منتج"
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {products.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {state.errors?.productId && (
            <span className="text-xs text-destructive">{state.errors.productId[0]}</span>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="marketId">السوق *</Label>
          <Select name="marketId">
            <SelectTrigger id="marketId" className="w-full">
              <SelectValue placeholder="اختر سوق">
                {(value: string | null) =>
                  value ? (markets.find((m) => m.id === value)?.label ?? value) : "اختر سوق"
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {markets.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {state.errors?.marketId && (
            <span className="text-xs text-destructive">{state.errors.marketId[0]}</span>
          )}
        </div>
      </div>

      <div className="flex w-32 flex-col gap-1.5">
        <Label htmlFor="year">السنة *</Label>
        <Input id="year" name="year" type="number" defaultValue={new Date().getFullYear()} />
      </div>

      {state.formError && (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.formError}</p>
      )}

      {pending && (
        <p className="rounded-lg bg-sky-50 px-3 py-2 text-sm text-sky-700">
          بيبحث ويحلل السوق دلوقتي — ممكن ياخد لغاية دقيقة، من فضلك استنى...
        </p>
      )}

      <Button type="submit" disabled={pending} className="w-fit">
        {pending ? "جاري التحليل..." : "حلّل بالذكاء الاصطناعي"}
      </Button>
    </Form>
  );
}
