"use client";

import { useActionState } from "react";
import { addFreightQuoteLine, type FreightQuoteLineFormState } from "../actions";
import { freightQuoteLineCategoryLabel } from "@/lib/logisticsLabels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import CurrencySelect from "@/components/CurrencySelect";

const initialState: FreightQuoteLineFormState = {};
const categories = Object.keys(freightQuoteLineCategoryLabel);

export default function FreightQuoteLineForm({ freightQuoteId }: { freightQuoteId: string }) {
  const action = addFreightQuoteLine.bind(null, freightQuoteId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="chargeCode" className="text-xs">
          كود البند *
        </Label>
        <Input id="chargeCode" name="chargeCode" className="w-32" placeholder="THC" />
        {state.errors?.chargeCode && <span className="text-xs text-destructive">{state.errors.chargeCode[0]}</span>}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="fql-category" className="text-xs">
          الفئة
        </Label>
        <Select name="category" defaultValue={categories[1]}>
          <SelectTrigger id="fql-category" className="w-32">
            <SelectValue>{(value: string) => freightQuoteLineCategoryLabel[value] ?? value}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {categories.map((c) => (
              <SelectItem key={c} value={c}>
                {freightQuoteLineCategoryLabel[c]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="fql-amount" className="text-xs">
          المبلغ *
        </Label>
        <Input id="fql-amount" name="amount" type="number" min="0" step="0.01" className="w-28" />
        {state.errors?.amount && <span className="text-xs text-destructive">{state.errors.amount[0]}</span>}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="fql-currency" className="text-xs">
          العملة
        </Label>
        <CurrencySelect id="fql-currency" name="currency" className="w-20" />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "جاري الإضافة..." : "+ بند"}
      </Button>
      {state.formError && <p role="alert" className="w-full text-sm text-destructive">{state.formError}</p>}
    </form>
  );
}
