"use client";

import { useActionState } from "react";
import { createActualLogisticsCost, type ActualLogisticsCostFormState } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import CurrencySelect from "@/components/CurrencySelect";

const initialState: ActualLogisticsCostFormState = {};

export default function ActualLogisticsCostForm({ shipmentId }: { shipmentId: string }) {
  const action = createActualLogisticsCost.bind(null, shipmentId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="costType" className="text-xs">
          نوع التكلفة *
        </Label>
        <Input id="costType" name="costType" className="w-32" placeholder="THC" />
        {state.errors?.costType && <span className="text-xs text-destructive">{state.errors.costType[0]}</span>}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="expectedAmount" className="text-xs">
          المبلغ المتوقع
        </Label>
        <Input id="expectedAmount" name="expectedAmount" type="number" min="0" step="0.01" className="w-28" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="actualAmount" className="text-xs">
          المبلغ الفعلي
        </Label>
        <Input id="actualAmount" name="actualAmount" type="number" min="0" step="0.01" className="w-28" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="alc-currency" className="text-xs">
          العملة
        </Label>
        <CurrencySelect id="alc-currency" name="currency" className="w-20" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="invoiceReference" className="text-xs">
          مرجع الفاتورة
        </Label>
        <Input id="invoiceReference" name="invoiceReference" className="w-32" />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "جاري التسجيل..." : "+ تكلفة"}
      </Button>
      {state.formError && <p role="alert" className="w-full text-sm text-destructive">{state.formError}</p>}
    </form>
  );
}
