"use client";

import { useActionState } from "react";
import { createNegotiationRound, type NegotiationRoundFormState } from "./actions";
import { negotiationConcessionTypeLabel } from "@/lib/negotiationLabels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form } from "@/components/ui/form";

const initialState: NegotiationRoundFormState = {};
const concessionTypes = Object.keys(negotiationConcessionTypeLabel);

export default function NegotiationRoundForm({ opportunityId, negotiationId, nextRoundNumber }: { opportunityId: string; negotiationId: string; nextRoundNumber: number }) {
  const action = createNegotiationRound.bind(null, opportunityId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <Form action={formAction} state={state} className="flex flex-wrap items-end gap-2 rounded-lg bg-muted/40 p-3">
      <input type="hidden" name="negotiationId" value={negotiationId} />
      <div className="flex flex-col gap-1">
        <Label htmlFor={`roundNumber-${negotiationId}`} className="text-xs">
          رقم الجولة
        </Label>
        <Input id={`roundNumber-${negotiationId}`} name="roundNumber" type="number" min="1" step="1" defaultValue={nextRoundNumber} className="w-20" />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor={`customerOffer-${negotiationId}`} className="text-xs">
          عرض العميل
        </Label>
        <Input id={`customerOffer-${negotiationId}`} name="customerOffer" type="number" step="0.0001" className="w-24" />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor={`ourOffer-${negotiationId}`} className="text-xs">
          عرضنا
        </Label>
        <Input id={`ourOffer-${negotiationId}`} name="ourOffer" type="number" step="0.0001" className="w-24" />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor={`discountPct-${negotiationId}`} className="text-xs">
          نسبة الخصم %
        </Label>
        <Input id={`discountPct-${negotiationId}`} name="discountPct" type="number" min="0" max="100" step="0.1" className="w-20" />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor={`concessionType-${negotiationId}`} className="text-xs">
          نوع التنازل
        </Label>
        <Select name="concessionType">
          <SelectTrigger id={`concessionType-${negotiationId}`} className="w-32">
            <SelectValue placeholder="—">{(value: string) => negotiationConcessionTypeLabel[value] ?? value}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {concessionTypes.map((c) => (
              <SelectItem key={c} value={c}>
                {negotiationConcessionTypeLabel[c]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor={`outcome-${negotiationId}`} className="text-xs">
          النتيجة
        </Label>
        <Input id={`outcome-${negotiationId}`} name="outcome" className="w-32" />
      </div>
      <Button type="submit" variant="outline" size="sm" disabled={pending}>
        {pending ? "جاري الإضافة..." : "+ جولة"}
      </Button>
      {state.formError && <p role="alert" className="w-full text-xs text-destructive">{state.formError}</p>}
    </Form>
  );
}
