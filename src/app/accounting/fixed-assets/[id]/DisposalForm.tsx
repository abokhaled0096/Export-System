"use client";

import { useActionState, useState } from "react";
import { disposeFixedAssetAction, type DisposalFormState } from "../../finance-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: DisposalFormState = {};

export default function DisposalForm({ assetId, netBookValue, currency }: { assetId: string; netBookValue: string; currency: string }) {
  const action = disposeFixedAssetAction.bind(null, assetId);
  const [state, formAction, pending] = useActionState(action, initialState);
  const [value, setValue] = useState("");

  const gainLoss = value ? Number(value) - Number(netBookValue) : null;

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="disp-date" className="text-xs">
          تاريخ التخلص *
        </Label>
        <Input id="disp-date" name="disposalDate" type="date" className="w-40" />
        {state.errors?.disposalDate && <span className="text-xs text-destructive">{state.errors.disposalDate[0]}</span>}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="disp-value" className="text-xs">
          حصيلة البيع ({currency}) *
        </Label>
        <Input id="disp-value" name="disposalValue" type="number" step="0.01" className="w-36" value={value} onChange={(e) => setValue(e.target.value)} />
        {state.errors?.disposalValue && <span className="text-xs text-destructive">{state.errors.disposalValue[0]}</span>}
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "..." : "تأكيد التخلص وترحيل القيد"}
      </Button>
      <div className="w-full text-xs text-amber-800">
        القيمة الدفترية الصافية الحالية: {netBookValue} {currency}.
        {gainLoss !== null && !Number.isNaN(gainLoss) && (
          <>
            {" "}
            الفرق المتوقّع: <span className={gainLoss >= 0 ? "font-semibold text-emerald-700" : "font-semibold text-rose-700"}>
              {gainLoss >= 0 ? "ربح" : "خسارة"} {Math.abs(gainLoss).toFixed(2)}
            </span>
          </>
        )}
      </div>
      {state.formError && (
        <p role="alert" className="w-full text-sm text-destructive">
          {state.formError}
        </p>
      )}
    </form>
  );
}
