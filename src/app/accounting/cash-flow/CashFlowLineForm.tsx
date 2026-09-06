"use client";

import { useActionState } from "react";
import { upsertCashFlowLine, type CashFlowLineFormState } from "../treasury-actions";
import { cashFlowCategoryLabel, MANUAL_CASH_FLOW_CATEGORIES } from "@/lib/treasuryLabels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const initialState: CashFlowLineFormState = {};

export default function CashFlowLineForm({ weeks, currency }: { weeks: string[]; currency: string }) {
  const [state, formAction, pending] = useActionState(upsertCashFlowLine, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
      <input type="hidden" name="currency" value={currency} />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="cf-week" className="text-xs">
          الأسبوع *
        </Label>
        <Select name="weekStartDate" defaultValue={weeks[0]}>
          <SelectTrigger id="cf-week" className="w-40">
            <SelectValue>{(value: string) => value || "—"}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {weeks.map((w) => (
              <SelectItem key={w} value={w}>
                {w}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="cf-category" className="text-xs">
          الفئة *
        </Label>
        <Select name="category" defaultValue={MANUAL_CASH_FLOW_CATEGORIES[0]}>
          <SelectTrigger id="cf-category" className="w-44">
            <SelectValue>{(value: string) => cashFlowCategoryLabel[value] ?? value}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {MANUAL_CASH_FLOW_CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>
                {cashFlowCategoryLabel[c]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="cf-amount" className="text-xs">
          المبلغ ({currency}) *
        </Label>
        <Input id="cf-amount" name="amount" type="number" step="0.01" className="w-32" />
        {state.errors?.amount && <span className="text-xs text-destructive">{state.errors.amount[0]}</span>}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="cf-notes" className="text-xs">
          ملاحظات
        </Label>
        <Input id="cf-notes" name="notes" className="w-48" />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "جاري الحفظ..." : "حفظ التوقّع"}
      </Button>
      <p className="w-full text-xs text-muted-foreground">
        التوقّع اليدوي للحاجات اللي النظام ما يعرفهاش (رواتب، ضرائب، استثمارات). الرصيد الافتتاحي/الختامي محسوبان — مش إدخال.
      </p>
      {state.formError && (
        <p role="alert" className="w-full text-sm text-destructive">
          {state.formError}
        </p>
      )}
    </form>
  );
}
