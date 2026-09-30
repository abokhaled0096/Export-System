"use client";

import { useActionState } from "react";
import { updateClaimStatus, type UpdateClaimStatusState } from "../actions";
import { claimStatusLabel } from "@/lib/logisticsLabels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form } from "@/components/ui/form";

const initialState: UpdateClaimStatusState = {};

export default function ClaimStatusForm({
  claimId,
  shipmentId,
  currentStatus,
  allowedNextStatuses,
}: {
  claimId: string;
  shipmentId: string;
  currentStatus: string;
  allowedNextStatuses: string[];
}) {
  const action = updateClaimStatus.bind(null, claimId, shipmentId);
  const [state, formAction, pending] = useActionState(action, initialState);
  const selectableStatuses = [currentStatus, ...allowedNextStatuses.filter((s) => s !== currentStatus)];

  return (
    <Form action={formAction} state={state} className="flex items-center gap-2">
      <Select name="status" defaultValue={currentStatus}>
        <SelectTrigger className="w-40">
          <SelectValue>{(value: string) => claimStatusLabel[value] ?? value}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {selectableStatuses.map((s) => (
            <SelectItem key={s} value={s}>
              {claimStatusLabel[s]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input name="settlementAmount" type="number" min="0" step="0.01" placeholder="مبلغ التسوية" className="w-28" />
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        {pending ? "..." : "حفظ"}
      </Button>
      {state.formError && <span role="alert" className="text-xs text-destructive">{state.formError}</span>}
    </Form>
  );
}
