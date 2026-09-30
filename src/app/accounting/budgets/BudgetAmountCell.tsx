"use client";

import { useActionState, useState } from "react";
import { updateBudgetAction, type BudgetEditFormState } from "../finance-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form } from "@/components/ui/form";

const initialState: BudgetEditFormState = {};

export default function BudgetAmountCell({ budgetId, amount, currency }: { budgetId: string; amount: string; currency: string }) {
  const [editing, setEditing] = useState(false);
  const [state, formAction, pending] = useActionState(updateBudgetAction.bind(null, budgetId), initialState);

  const [prevState, setPrevState] = useState(state);
  if (state !== prevState) {
    setPrevState(state);
    if (state.success) setEditing(false);
  }

  if (!editing) {
    return (
      <button type="button" className="font-mono text-foreground/80 hover:underline" onClick={() => setEditing(true)} title="تعديل المبلغ">
        {amount} {currency}
      </button>
    );
  }

  return (
    <Form action={formAction} state={state} className="flex items-center gap-1.5">
      <Input name="amount" type="number" step="0.01" defaultValue={amount} className="w-28" autoFocus />
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "..." : "حفظ"}
      </Button>
      <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>
        إلغاء
      </Button>
      {state.errors?.amount && <span className="text-xs text-destructive">{state.errors.amount[0]}</span>}
      {state.formError && <span className="text-xs text-destructive">{state.formError}</span>}
    </Form>
  );
}
