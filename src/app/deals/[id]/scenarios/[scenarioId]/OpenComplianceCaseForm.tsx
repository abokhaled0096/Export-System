"use client";

import { useActionState } from "react";
import { createComplianceCase, type ComplianceCaseFormState } from "@/app/compliance/actions";
import { operationTypeLabel } from "@/lib/complianceLabels";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const initialState: ComplianceCaseFormState = {};

const operationTypes = Object.keys(operationTypeLabel);

export default function OpenComplianceCaseForm({
  dealId,
  scenarioId,
  suppliers,
}: {
  dealId: string;
  scenarioId: string;
  suppliers: { id: string; legalName: string }[];
}) {
  const action = createComplianceCase.bind(null, dealId, scenarioId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="operationType" className="text-xs">
          نوع العملية
        </Label>
        <Select name="operationType" defaultValue={operationTypes[0]}>
          <SelectTrigger id="operationType" className="w-48">
            <SelectValue>{(value: string) => operationTypeLabel[value] ?? value}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {operationTypes.map((t) => (
              <SelectItem key={t} value={t}>
                {operationTypeLabel[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {suppliers.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="occ-supplierId" className="text-xs">
            المورّد
          </Label>
          <Select name="supplierId">
            <SelectTrigger id="occ-supplierId" className="w-40">
              <SelectValue placeholder="—">
                {(value: string) => suppliers.find((s) => s.id === value)?.legalName ?? value}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {suppliers.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.legalName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? "جاري الفتح..." : "فتح ملف امتثال"}
      </Button>
      {state.formError && <span role="alert" className="text-xs text-destructive">{state.formError}</span>}
    </form>
  );
}
