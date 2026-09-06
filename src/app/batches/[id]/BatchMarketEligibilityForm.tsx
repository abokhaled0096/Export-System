"use client";

import { useActionState } from "react";
import { createBatchMarketEligibility, type BatchMarketEligibilityFormState } from "../actions";
import { batchMarketEligibilityStatusLabel } from "@/lib/procurementLabels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const initialState: BatchMarketEligibilityFormState = {};
const statuses = Object.keys(batchMarketEligibilityStatusLabel);

export default function BatchMarketEligibilityForm({ batchId, markets }: { batchId: string; markets: { id: string; countryNameAr: string }[] }) {
  const action = createBatchMarketEligibility.bind(null, batchId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="marketId" className="text-xs">
          السوق *
        </Label>
        <Select name="marketId">
          <SelectTrigger id="marketId" className="w-36">
            <SelectValue placeholder="اختر سوق">{(value: string) => markets.find((m) => m.id === value)?.countryNameAr ?? value}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {markets.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.countryNameAr}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {state.errors?.marketId && <span className="text-xs text-destructive">{state.errors.marketId[0]}</span>}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="bme-status" className="text-xs">
          الحالة *
        </Label>
        <Select name="status" defaultValue={statuses[0]}>
          <SelectTrigger id="bme-status" className="w-32">
            <SelectValue>{(value: string) => batchMarketEligibilityStatusLabel[value] ?? value}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {statuses.map((s) => (
              <SelectItem key={s} value={s}>
                {batchMarketEligibilityStatusLabel[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="reason" className="text-xs">
          السبب
        </Label>
        <Input id="reason" name="reason" className="w-40" />
      </div>
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? "جاري التقييم..." : "+ تقييم أهلية"}
      </Button>
      {state.formError && <p role="alert" className="w-full text-sm text-destructive">{state.formError}</p>}
    </form>
  );
}
