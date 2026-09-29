"use client";

import { useActionState } from "react";
import { createCompetitor, type CompetitorFormState } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import CurrencySelect from "@/components/CurrencySelect";

const initialState: CompetitorFormState = {};
type Option = { id: string; label: string };
const monthLabel = ["", "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];

export default function CompetitorForm({ products, markets }: { products: Option[]; markets: Option[] }) {
  const [state, formAction, pending] = useActionState(createCompetitor, initialState);

  return (
    <form action={formAction} className="flex max-w-xl flex-col gap-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="productId">المنتج *</Label>
          <Select name="productId">
            <SelectTrigger id="productId" className="w-full">
              <SelectValue placeholder="اختر منتج">
                {(value: string | null) => (value ? (products.find((p) => p.id === value)?.label ?? value) : "اختر منتج")}
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
          {state.errors?.productId && <span className="text-xs text-destructive">{state.errors.productId[0]}</span>}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="marketId">السوق *</Label>
          <Select name="marketId">
            <SelectTrigger id="marketId" className="w-full">
              <SelectValue placeholder="اختر سوق">
                {(value: string | null) => (value ? (markets.find((m) => m.id === value)?.label ?? value) : "اختر سوق")}
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
          {state.errors?.marketId && <span className="text-xs text-destructive">{state.errors.marketId[0]}</span>}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="countryName">اسم الدولة المنافسة *</Label>
        <Input id="countryName" name="countryName" placeholder="مثال: تركيا" />
        {state.errors?.countryName && <span className="text-xs text-destructive">{state.errors.countryName[0]}</span>}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs text-emerald-700">شهور القوة (موسميًا)</Label>
          <div className="grid grid-cols-4 gap-1.5">
            {monthLabel.slice(1).map((label, i) => (
              <label key={i} className="flex items-center gap-1 text-xs">
                <input type="checkbox" name="strengthMonths" value={i + 1} className="size-3.5" />
                {label}
              </label>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs text-rose-700">شهور الضعف (موسميًا)</Label>
          <div className="grid grid-cols-4 gap-1.5">
            {monthLabel.slice(1).map((label, i) => (
              <label key={i} className="flex items-center gap-1 text-xs">
                <input type="checkbox" name="weaknessMonths" value={i + 1} className="size-3.5" />
                {label}
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="priceRangeMin">أقل سعر تصدير</Label>
          <Input id="priceRangeMin" name="priceRangeMin" type="number" step="0.01" min="0" />
          {state.errors?.priceRangeMin && <span className="text-xs text-destructive">{state.errors.priceRangeMin[0]}</span>}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="priceRangeMax">أعلى سعر تصدير</Label>
          <Input id="priceRangeMax" name="priceRangeMax" type="number" step="0.01" min="0" />
          {state.errors?.priceRangeMax && <span className="text-xs text-destructive">{state.errors.priceRangeMax[0]}</span>}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="currency">العملة *</Label>
          <CurrencySelect id="currency" name="currency" defaultValue="USD" />
          {state.errors?.currency && <span className="text-xs text-destructive">{state.errors.currency[0]}</span>}
        </div>
      </div>

      <Button type="submit" disabled={pending} className="w-fit">
        {pending ? "جاري الحفظ..." : "+ منافس"}
      </Button>

      {state.formError && (
        <p role="alert" className="text-sm text-destructive">
          {state.formError}
        </p>
      )}
    </form>
  );
}
