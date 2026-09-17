"use client";

import { useActionState, useState } from "react";
import { updateTaxRecordAction, type TaxRecordEditFormState } from "../finance-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const initialState: TaxRecordEditFormState = {};

export default function TaxRecordEditCell({
  taxRecordId,
  amount,
  currency,
  etaReference,
  amountEditable,
}: {
  taxRecordId: string;
  amount: string;
  currency: string;
  etaReference: string | null;
  amountEditable: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [state, formAction, pending] = useActionState(updateTaxRecordAction.bind(null, taxRecordId), initialState);

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
      {amountEditable && (
        <div className="flex items-center gap-1.5">
          <Input name="amount" type="number" step="0.01" defaultValue={amount} className="w-24" />
          <span className="text-xs text-muted-foreground">{currency}</span>
        </div>
      )}
      <Input name="etaReference" placeholder="مرجع ETA" defaultValue={etaReference ?? ""} className="w-40" />
      <div className="flex items-center gap-1.5">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "..." : "حفظ"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>
          إلغاء
        </Button>
      </div>
      {state.errors?.amount && <span className="text-xs text-destructive">{state.errors.amount[0]}</span>}
      {state.formError && <span className="text-xs text-destructive">{state.formError}</span>}
    </form>
  );
}
