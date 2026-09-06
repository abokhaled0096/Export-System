"use client";

import { useActionState } from "react";
import { createClaim, type ClaimFormState } from "../actions";
import { claimTypeLabel } from "@/lib/logisticsLabels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const initialState: ClaimFormState = {};
const types = Object.keys(claimTypeLabel);

export default function ClaimForm({ shipmentId }: { shipmentId: string }) {
  const action = createClaim.bind(null, shipmentId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="claimType" className="text-xs">
          نوع المطالبة
        </Label>
        <Select name="claimType" defaultValue={types[0]}>
          <SelectTrigger id="claimType" className="w-36">
            <SelectValue>{(value: string) => claimTypeLabel[value] ?? value}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {types.map((t) => (
              <SelectItem key={t} value={t}>
                {claimTypeLabel[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="claimedAgainst" className="text-xs">
          المطالَب ضده
        </Label>
        <Input id="claimedAgainst" name="claimedAgainst" className="w-32" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="incidentDate" className="text-xs">
          تاريخ الحادثة
        </Label>
        <Input id="incidentDate" name="incidentDate" type="date" className="w-40" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="notificationDate" className="text-xs">
          تاريخ الإخطار
        </Label>
        <Input id="notificationDate" name="notificationDate" type="date" className="w-40" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="claimDeadline" className="text-xs">
          آخر موعد للمطالبة
        </Label>
        <Input id="claimDeadline" name="claimDeadline" type="date" className="w-40" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="claimedAmount" className="text-xs">
          المبلغ المطالَب به
        </Label>
        <Input id="claimedAmount" name="claimedAmount" type="number" min="0" step="0.01" className="w-28" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="claim-currency" className="text-xs">
          العملة
        </Label>
        <Input id="claim-currency" name="currency" className="w-20" placeholder="USD" />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "جاري التسجيل..." : "+ مطالبة"}
      </Button>
      {state.formError && <p role="alert" className="w-full text-sm text-destructive">{state.formError}</p>}
    </form>
  );
}
