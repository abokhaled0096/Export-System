"use client";

import { useActionState } from "react";
import { createCostCenter, type CostCenterFormState } from "../actions";
import { costCenterTypeLabel } from "@/lib/accountingLabels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const initialState: CostCenterFormState = {};
const types = Object.keys(costCenterTypeLabel);

export default function CostCenterForm() {
  const [state, formAction, pending] = useActionState(createCostCenter, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="code" className="text-xs">
          الكود *
        </Label>
        <Input id="code" name="code" className="w-24" />
        {state.errors?.code && <span className="text-xs text-destructive">{state.errors.code[0]}</span>}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="cc-name" className="text-xs">
          الاسم *
        </Label>
        <Input id="cc-name" name="name" className="w-40" />
        {state.errors?.name && <span className="text-xs text-destructive">{state.errors.name[0]}</span>}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="cc-type" className="text-xs">
          النوع
        </Label>
        <Select name="type" defaultValue={types[0]}>
          <SelectTrigger id="cc-type" className="w-32">
            <SelectValue>{(value: string) => costCenterTypeLabel[value] ?? value}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {types.map((t) => (
              <SelectItem key={t} value={t}>
                {costCenterTypeLabel[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "جاري الإضافة..." : "+ مركز تكلفة"}
      </Button>
      {state.formError && <p role="alert" className="w-full text-sm text-destructive">{state.formError}</p>}
    </form>
  );
}
