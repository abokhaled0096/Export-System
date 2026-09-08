"use client";

import { useActionState } from "react";
import { decideGate, requestGateWaiver, type DecideGateState, type RequestGateWaiverState } from "../actions";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const decideInitial: DecideGateState = {};
const waiverInitial: RequestGateWaiverState = {};

const directStatusLabel: Record<string, string> = {
  Passed: "عدّت",
  PassedWithConditions: "عدّت بشروط",
  Failed: "فشلت",
  NotApplicable: "غير منطبقة",
};

export default function GateDecisionForm({
  gateId,
  complianceCaseId,
  allowedNextStatuses,
  hasPendingWaiver,
}: {
  gateId: string;
  complianceCaseId: string;
  allowedNextStatuses: string[];
  hasPendingWaiver: boolean;
}) {
  const [decideState, decideAction, decidePending] = useActionState(
    decideGate.bind(null, gateId, complianceCaseId),
    decideInitial
  );
  const [waiverState, waiverAction, waiverPending] = useActionState(
    requestGateWaiver.bind(null, gateId, complianceCaseId),
    waiverInitial
  );

  // مفيش انتقالات مسموحة أصلًا (جدول WorkflowDefinition، وحدة 9) = بوابة اتقررت بالفعل
  // (Passed/PassedWithConditions/Waived) — بديل عن الفحص الحرفي القديم، بدل خريطة TS ثابتة.
  if (allowedNextStatuses.length === 0) {
    return null;
  }
  const directStatuses = allowedNextStatuses;

  return (
    <div className="flex flex-col gap-1.5">
      <form action={decideAction} className="flex items-center gap-2">
        <Select name="status" defaultValue={directStatuses[0]}>
          <SelectTrigger className="w-40">
            <SelectValue>{(value: string) => directStatusLabel[value] ?? value}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {directStatuses.map((s) => (
              <SelectItem key={s} value={s}>
                {directStatusLabel[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="submit" size="sm" variant="outline" disabled={decidePending}>
          {decidePending ? "..." : "قرار"}
        </Button>
      </form>
      {decideState.formError && <span role="alert" className="text-xs text-destructive">{decideState.formError}</span>}

      {!hasPendingWaiver ? (
        <form action={waiverAction}>
          <Button type="submit" size="sm" variant="ghost" className="text-amber-700 hover:text-amber-800" disabled={waiverPending}>
            {waiverPending ? "..." : "اطلب تجاوز استثنائي (Waiver)"}
          </Button>
        </form>
      ) : (
        <span className="text-xs text-amber-700">طلب التجاوز معلّق — راجع /approvals</span>
      )}
      {waiverState.formError && <span role="alert" className="text-xs text-destructive">{waiverState.formError}</span>}
    </div>
  );
}
