"use client";

import { useActionState } from "react";
import { createProfitCenter, type ProfitCenterFormState } from "../actions";
import { profitCenterScopeLabel } from "@/lib/accountingLabels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const initialState: ProfitCenterFormState = {};
const scopes = Object.keys(profitCenterScopeLabel);

export default function ProfitCenterForm() {
  const [state, formAction, pending] = useActionState(createProfitCenter, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="pc-code" className="text-xs">
          الكود *
        </Label>
        <Input id="pc-code" name="code" className="w-24" />
        {state.errors?.code && <span className="text-xs text-destructive">{state.errors.code[0]}</span>}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="pc-name" className="text-xs">
          الاسم *
        </Label>
        <Input id="pc-name" name="name" className="w-40" />
        {state.errors?.name && <span className="text-xs text-destructive">{state.errors.name[0]}</span>}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="pc-scope" className="text-xs">
          النطاق
        </Label>
        <Select name="scope" defaultValue={scopes[0]}>
          <SelectTrigger id="pc-scope" className="w-32">
            <SelectValue>{(value: string) => profitCenterScopeLabel[value] ?? value}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {scopes.map((s) => (
              <SelectItem key={s} value={s}>
                {profitCenterScopeLabel[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "جاري الإضافة..." : "+ مركز ربحية"}
      </Button>
      {state.formError && <p role="alert" className="w-full text-sm text-destructive">{state.formError}</p>}
    </form>
  );
}
