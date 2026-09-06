"use client";

import { useActionState } from "react";
import { updateMilestone, type UpdateMilestoneState } from "../actions";
import { milestoneStatusLabel } from "@/lib/logisticsLabels";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const initialState: UpdateMilestoneState = {};
const statuses = Object.keys(milestoneStatusLabel);

export default function MilestoneStatusForm({
  milestoneId,
  shipmentId,
  currentStatus,
}: {
  milestoneId: string;
  shipmentId: string;
  currentStatus: string;
}) {
  const action = updateMilestone.bind(null, milestoneId, shipmentId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex items-center gap-2">
      <Select name="status" defaultValue={currentStatus}>
        <SelectTrigger className="w-36">
          <SelectValue>{(value: string) => milestoneStatusLabel[value] ?? value}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {statuses.map((s) => (
            <SelectItem key={s} value={s}>
              {milestoneStatusLabel[s]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        {pending ? "..." : "حفظ"}
      </Button>
      {state.formError && <span role="alert" className="text-xs text-destructive">{state.formError}</span>}
    </form>
  );
}
