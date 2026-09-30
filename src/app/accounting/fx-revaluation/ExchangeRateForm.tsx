"use client";

import { useActionState } from "react";
import { createExchangeRateAction, type ExchangeRateFormState } from "../finance-actions";
import { exchangeRateTypeLabel } from "@/lib/treasuryLabels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import CurrencySelect from "@/components/CurrencySelect";

const initialState: ExchangeRateFormState = {};

const rateTypes = ["Spot", "Budget", "Contracted", "Actual"] as const;

export default function ExchangeRateForm() {
  const [state, formAction, pending] = useActionState(createExchangeRateAction, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="baseCurrency" className="text-xs">
          العملة الأجنبية *
        </Label>
        <CurrencySelect id="baseCurrency" name="baseCurrency" defaultValue="USD" className="w-40" />
        {state.errors?.baseCurrency && <span className="text-xs text-destructive">{state.errors.baseCurrency[0]}</span>}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="quoteCurrency" className="text-xs">
          العملة الوظيفية *
        </Label>
        <CurrencySelect id="quoteCurrency" name="quoteCurrency" defaultValue="EGP" className="w-40" />
        {state.errors?.quoteCurrency && <span className="text-xs text-destructive">{state.errors.quoteCurrency[0]}</span>}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="rate" className="text-xs">
          السعر *
        </Label>
        <Input id="rate" name="rate" type="number" min="0" step="0.00000001" className="w-32" />
        {state.errors?.rate && <span className="text-xs text-destructive">{state.errors.rate[0]}</span>}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="rateDate" className="text-xs">
          التاريخ *
        </Label>
        <Input id="rateDate" name="rateDate" type="date" className="w-40" />
        {state.errors?.rateDate && <span className="text-xs text-destructive">{state.errors.rateDate[0]}</span>}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="rateType" className="text-xs">
          النوع
        </Label>
        <Select name="rateType" defaultValue="Spot">
          <SelectTrigger id="rateType" className="w-32">
            <SelectValue>{(value: string) => exchangeRateTypeLabel[value] ?? value}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {rateTypes.map((t) => (
              <SelectItem key={t} value={t}>
                {exchangeRateTypeLabel[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "جاري التسجيل..." : "+ سعر صرف"}
      </Button>
      {state.formError && <p role="alert" className="w-full text-sm text-destructive">{state.formError}</p>}
    </form>
  );
}
