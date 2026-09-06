"use client";

import { useActionState } from "react";
import { setFinalPrice, type FinalPriceFormState } from "../../../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: FinalPriceFormState = {};

export default function FinalPriceForm({
  scenarioId,
  currency,
  currentValue,
  lockVersion,
}: {
  scenarioId: string;
  currency: string;
  currentValue?: string;
  lockVersion: number;
}) {
  const action = setFinalPrice.bind(null, scenarioId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex items-end gap-3">
      <input type="hidden" name="expectedLockVersion" value={lockVersion} />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="finalPrice" className="text-xs">
          السعر النهائي المتفاوَض عليه ({currency})
        </Label>
        <Input
          id="finalPrice"
          name="finalPrice"
          type="number"
          step="0.0001"
          defaultValue={currentValue}
          className="w-40"
        />
      </div>
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? "جاري الحفظ..." : "حفظ السعر"}
      </Button>
      {state.errors?.finalPrice && <span className="text-xs text-destructive">{state.errors.finalPrice[0]}</span>}
      {state.formError && <span role="alert" className="text-xs text-destructive">{state.formError}</span>}
    </form>
  );
}
