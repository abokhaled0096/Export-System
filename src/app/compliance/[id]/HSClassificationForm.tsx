"use client";

import { useActionState } from "react";
import { createHSClassification, type HSClassificationFormState } from "../actions";
import { hsClassificationStatusLabel } from "@/lib/complianceLabels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const initialState: HSClassificationFormState = {};
const statuses = Object.keys(hsClassificationStatusLabel);

export default function HSClassificationForm({
  complianceCaseId,
  productId,
  marketId,
}: {
  complianceCaseId: string;
  productId: string;
  marketId: string;
}) {
  const action = createHSClassification.bind(null, complianceCaseId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="marketId" value={marketId} />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="hsCode" className="text-xs">
          HS Code *
        </Label>
        <Input id="hsCode" name="hsCode" className="w-32" placeholder="0811.10" />
        {state.errors?.hsCode && <span className="text-xs text-destructive">{state.errors.hsCode[0]}</span>}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="dutyRatePct" className="text-xs">
          نسبة الرسوم %
        </Label>
        <Input id="dutyRatePct" name="dutyRatePct" type="number" step="0.01" min="0" max="100" className="w-24" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="rulingReference" className="text-xs">
          مرجع القرار الجمركي
        </Label>
        <Input id="rulingReference" name="rulingReference" className="w-40" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="hs-status" className="text-xs">
          الحالة
        </Label>
        <Select name="status" defaultValue={statuses[0]}>
          <SelectTrigger id="hs-status" className="w-44">
            <SelectValue>{(value: string) => hsClassificationStatusLabel[value] ?? value}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {statuses.map((s) => (
              <SelectItem key={s} value={s}>
                {hsClassificationStatusLabel[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "جاري الإضافة..." : "+ تصنيف جمركي"}
      </Button>
      {state.formError && <p role="alert" className="w-full text-sm text-destructive">{state.formError}</p>}
    </form>
  );
}
