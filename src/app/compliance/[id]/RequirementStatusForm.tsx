"use client";

import { useActionState } from "react";
import { updateRequirementStatus, type UpdateRequirementStatusState } from "../actions";
import { requirementStatusLabel } from "@/lib/complianceLabels";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const initialState: UpdateRequirementStatusState = {};
const statuses = Object.keys(requirementStatusLabel);

export default function RequirementStatusForm({
  requirementId,
  complianceCaseId,
  currentStatus,
}: {
  requirementId: string;
  complianceCaseId: string;
  currentStatus: string;
}) {
  const action = updateRequirementStatus.bind(null, requirementId, complianceCaseId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex items-center gap-2">
      <Select name="status" defaultValue={currentStatus}>
        <SelectTrigger className="w-40">
          <SelectValue>{(value: string) => requirementStatusLabel[value] ?? value}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {statuses.map((s) => (
            <SelectItem key={s} value={s}>
              {requirementStatusLabel[s]}
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
