"use client";

import { useActionState } from "react";
import { createAnalysis, type AnalysisFormState } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const initialState: AnalysisFormState = {};

type Option = { id: string; label: string };

const recommendations = [
  { value: "Start", label: "ابدأ" },
  { value: "Study", label: "ادرس أكتر" },
  { value: "Monitor", label: "راقب" },
  { value: "Avoid", label: "تجنّب" },
];

export default function AnalysisForm({
  products,
  markets,
}: {
  products: Option[];
  markets: Option[];
}) {
  const [state, formAction, pending] = useActionState(createAnalysis, initialState);

  return (
    <form action={formAction} className="flex max-w-xl flex-col gap-5">
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

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="opportunityScore">درجة الفرصة (0-100) *</Label>
          <Input id="opportunityScore" name="opportunityScore" type="number" min={0} max={100} />
          {state.errors?.opportunityScore && (
            <span className="text-xs text-destructive">{state.errors.opportunityScore[0]}</span>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="riskScore">درجة المخاطرة (0-100) *</Label>
          <Input id="riskScore" name="riskScore" type="number" min={0} max={100} />
          {state.errors?.riskScore && (
            <span className="text-xs text-destructive">{state.errors.riskScore[0]}</span>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="recommendation">التوصية *</Label>
        <Select name="recommendation" defaultValue={recommendations[0].value}>
          <SelectTrigger id="recommendation" className="w-full">
            <SelectValue>
              {(value: string) => recommendations.find((r) => r.value === value)?.label ?? value}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {recommendations.map((r) => (
              <SelectItem key={r.value} value={r.value}>
                {r.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {state.formError && (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.formError}</p>
      )}

      <Button type="submit" disabled={pending} className="w-fit">
        {pending ? "جاري الحفظ..." : "حفظ التحليل"}
      </Button>
    </form>
  );
}
