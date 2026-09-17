"use client";

import { useActionState, useState } from "react";
import { updateKpiAction, type KpiEditFormState } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const initialState: KpiEditFormState = {};

export default function KpiEditControl({
  kpiId,
  name,
  category,
  targetValue,
  actualValue,
}: {
  kpiId: string;
  name: string;
  category: string;
  targetValue: string;
  actualValue: string | null;
}) {
  const [editing, setEditing] = useState(false);
  const [state, formAction, pending] = useActionState(updateKpiAction.bind(null, kpiId), initialState);

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
    <form action={formAction} className="flex flex-col gap-1.5 rounded-lg border border-border bg-secondary/40 p-2">
      <Input name="name" defaultValue={name} className="w-40" placeholder="الاسم" />
      {state.errors?.name && <span className="text-xs text-destructive">{state.errors.name[0]}</span>}
      <Input name="category" defaultValue={category} className="w-40" placeholder="الفئة" />
      {state.errors?.category && <span className="text-xs text-destructive">{state.errors.category[0]}</span>}
      <div className="flex items-center gap-1.5">
        <Input name="targetValue" type="number" step="0.01" defaultValue={targetValue} className="w-24" placeholder="المستهدف" />
        <Input name="actualValue" type="number" step="0.01" defaultValue={actualValue ?? ""} className="w-24" placeholder="الفعلي" />
      </div>
      <div className="flex items-center gap-1.5">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "..." : "حفظ"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>
          إلغاء
        </Button>
      </div>
      {state.formError && <span className="text-xs text-destructive">{state.formError}</span>}
    </form>
  );
}
