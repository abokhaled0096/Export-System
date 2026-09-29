"use client";

import { useActionState } from "react";
import { createBudget, type BudgetFormState } from "../finance-actions";
import { budgetTypeLabel } from "@/lib/treasuryLabels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import CurrencySelect from "@/components/CurrencySelect";

const initialState: BudgetFormState = {};
const types = Object.keys(budgetTypeLabel);

export type PeriodOption = { id: string; label: string };
export type CostCenterOption = { id: string; label: string };

export default function BudgetForm({ periods, costCenters }: { periods: PeriodOption[]; costCenters: CostCenterOption[] }) {
  const [state, formAction, pending] = useActionState(createBudget, initialState);

  if (periods.length === 0) {
    return (
      <p className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        لازم تضيف فترة محاسبية واحدة على الأقل قبل ما تسجّل بند موازنة.
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="bg-period" className="text-xs">
          الفترة *
        </Label>
        <Select name="periodId" defaultValue={periods[0]?.id}>
          <SelectTrigger id="bg-period" className="w-36">
            <SelectValue>{(value: string) => periods.find((p) => p.id === value)?.label ?? "—"}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {periods.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="bg-type" className="text-xs">
          النوع *
        </Label>
        <Select name="budgetType" defaultValue={types[0]}>
          <SelectTrigger id="bg-type" className="w-36">
            <SelectValue>{(value: string) => budgetTypeLabel[value] ?? value}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {types.map((t) => (
              <SelectItem key={t} value={t}>
                {budgetTypeLabel[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {costCenters.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="bg-cc" className="text-xs">
            مركز التكلفة
          </Label>
          <Select name="costCenterId">
            <SelectTrigger id="bg-cc" className="w-44">
              <SelectValue>{(value: string) => costCenters.find((c) => c.id === value)?.label ?? "— على مستوى المنظمة —"}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {costCenters.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="bg-amount" className="text-xs">
          المبلغ *
        </Label>
        <Input id="bg-amount" name="amount" type="number" step="0.01" className="w-32" />
        {state.errors?.amount && <span className="text-xs text-destructive">{state.errors.amount[0]}</span>}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="bg-currency" className="text-xs">
          العملة *
        </Label>
        <CurrencySelect id="bg-currency" name="currency" defaultValue="EGP" className="w-20" />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "جاري الإضافة..." : "+ بند موازنة"}
      </Button>
      {state.formError && (
        <p role="alert" className="w-full text-sm text-destructive">
          {state.formError}
        </p>
      )}
    </form>
  );
}
