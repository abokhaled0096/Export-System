"use client";

import { useActionState } from "react";
import { createNegotiation, type NegotiationFormState } from "./actions";
import { negotiationStatusLabel } from "@/lib/negotiationLabels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const initialState: NegotiationFormState = {};
const statuses = Object.keys(negotiationStatusLabel);

export default function NegotiationForm({ opportunityId }: { opportunityId: string }) {
  const action = createNegotiation.bind(null, opportunityId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="neg-status" className="text-xs">
          الحالة
        </Label>
        <Select name="status" defaultValue={statuses[0]}>
          <SelectTrigger id="neg-status" className="w-32">
            <SelectValue>{(value: string) => negotiationStatusLabel[value] ?? value}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {statuses.map((s) => (
              <SelectItem key={s} value={s}>
                {negotiationStatusLabel[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="currentPrice" className="text-xs">
          السعر الحالي
        </Label>
        <Input id="currentPrice" name="currentPrice" type="number" min="0" step="0.0001" className="w-28" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="neg-currency" className="text-xs">
          العملة
        </Label>
        <Input id="neg-currency" name="currency" placeholder="USD" className="w-20" />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "جاري الفتح..." : "+ تفاوض"}
      </Button>
      {state.formError && <p role="alert" className="w-full text-sm text-destructive">{state.formError}</p>}
    </form>
  );
}
