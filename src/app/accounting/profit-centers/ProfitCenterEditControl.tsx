"use client";

import { useActionState, useState } from "react";
import { updateProfitCenterAction, type ProfitCenterEditFormState } from "../actions";
import { profitCenterScopeLabel } from "@/lib/accountingLabels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const initialState: ProfitCenterEditFormState = {};
const scopes = Object.keys(profitCenterScopeLabel);

export default function ProfitCenterEditControl({ profitCenterId, name, scope }: { profitCenterId: string; name: string; scope: string }) {
  const [editing, setEditing] = useState(false);
  const [state, formAction, pending] = useActionState(updateProfitCenterAction.bind(null, profitCenterId), initialState);

  const [prevState, setPrevState] = useState(state);
  if (state !== prevState) {
    setPrevState(state);
    if (state.success) setEditing(false);
  }

  if (!editing) {
    return (
      <button type="button" className="text-xs text-primary hover:underline" onClick={() => setEditing(true)}>
        تعديل
      </button>
    );
  }

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-1.5">
      <Input name="name" defaultValue={name} className="w-32" />
      <Select name="scope" defaultValue={scope}>
        <SelectTrigger className="w-28">
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
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "..." : "حفظ"}
      </Button>
      <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>
        إلغاء
      </Button>
      {(state.errors?.name || state.formError) && <span className="text-xs text-destructive">{state.errors?.name?.[0] ?? state.formError}</span>}
    </form>
  );
}
