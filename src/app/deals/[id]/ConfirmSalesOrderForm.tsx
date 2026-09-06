"use client";

import { useActionState } from "react";
import { confirmSalesOrder, type ConfirmSalesOrderFormState } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: ConfirmSalesOrderFormState = {};

export default function ConfirmSalesOrderForm({ salesOrderId }: { salesOrderId: string }) {
  const action = confirmSalesOrder.bind(null, salesOrderId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="mt-3 flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="poNumber" className="text-xs">
          رقم أمر الشراء (PO) *
        </Label>
        <Input id="poNumber" name="poNumber" className="w-40" />
        {state.errors?.poNumber && <span className="text-xs text-destructive">{state.errors.poNumber[0]}</span>}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="poDate" className="text-xs">
          تاريخ أمر الشراء *
        </Label>
        <Input id="poDate" name="poDate" type="date" />
        {state.errors?.poDate && <span className="text-xs text-destructive">{state.errors.poDate[0]}</span>}
      </div>
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? "جاري التأكيد..." : "أكّد أمر البيع"}
      </Button>
      {state.formError && <p role="alert" className="w-full text-sm text-destructive">{state.formError}</p>}
    </form>
  );
}
