"use client";

import { useActionState } from "react";
import { createCommissionPlan, type CommissionPlanFormState } from "./actions";
import { commissionBasisLabel, commissionTriggerEventLabel } from "@/lib/commissionLabels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const initialState: CommissionPlanFormState = {};
const bases = Object.keys(commissionBasisLabel);
const triggerEvents = Object.keys(commissionTriggerEventLabel);

export default function CommissionPlanForm() {
  const [state, formAction, pending] = useActionState(createCommissionPlan, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="name" className="text-xs">
          اسم الخطة *
        </Label>
        <Input id="name" name="name" className="w-40" />
        {state.errors?.name && <span className="text-xs text-destructive">{state.errors.name[0]}</span>}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="basis" className="text-xs">
          الأساس
        </Label>
        <Select name="basis" defaultValue={bases[0]}>
          <SelectTrigger id="basis" className="w-40">
            <SelectValue>{(value: string) => commissionBasisLabel[value] ?? value}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {bases.map((b) => (
              <SelectItem key={b} value={b}>
                {commissionBasisLabel[b]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ratePct" className="text-xs">
          النسبة %
        </Label>
        <Input id="ratePct" name="ratePct" type="number" min="0" max="100" step="0.01" className="w-24" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="triggerEvent" className="text-xs">
          يُستحق عند
        </Label>
        <Select name="triggerEvent" defaultValue={triggerEvents[0]}>
          <SelectTrigger id="triggerEvent" className="w-40">
            <SelectValue>{(value: string) => commissionTriggerEventLabel[value] ?? value}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {triggerEvents.map((t) => (
              <SelectItem key={t} value={t}>
                {commissionTriggerEventLabel[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "جاري الإضافة..." : "+ خطة عمولة"}
      </Button>
      {state.formError && <p role="alert" className="w-full text-sm text-destructive">{state.formError}</p>}
    </form>
  );
}
