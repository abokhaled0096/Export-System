"use client";

import { useActionState } from "react";
import { createGate, type GateFormState } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

const initialState: GateFormState = {};

export default function GateForm({
  complianceCaseId,
  requirements,
  nextGateNumber,
}: {
  complianceCaseId: string;
  requirements: { id: string; name: string }[];
  nextGateNumber: number;
}) {
  const action = createGate.bind(null, complianceCaseId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="gateNumber" className="text-xs">
            رقم البوابة (1-12) *
          </Label>
          <Input id="gateNumber" name="gateNumber" type="number" min="1" max="12" defaultValue={nextGateNumber} className="w-24" />
          {state.errors?.gateNumber && <span className="text-xs text-destructive">{state.errors.gateNumber[0]}</span>}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="gateName" className="text-xs">
            اسم البوابة *
          </Label>
          <Input id="gateName" name="gateName" className="w-56" placeholder="اعتماد التصنيف الجمركي" />
          {state.errors?.gateName && <span className="text-xs text-destructive">{state.errors.gateName[0]}</span>}
        </div>
        <div className="flex items-center gap-1.5">
          <Checkbox id="requiresOriginProofVerification" name="requiresOriginProofVerification" />
          <Label htmlFor="requiresOriginProofVerification" className="text-xs font-normal">
            بوابة الشحن/الإبحار (تتطلب تحقق قواعد PEM)
          </Label>
        </div>
        <div className="flex items-center gap-1.5">
          <Checkbox id="requiresAciVerification" name="requiresAciVerification" />
          <Label htmlFor="requiresAciVerification" className="text-xs font-normal">
            بوابة الشحن/الإبحار (تتطلب تحقق مهلة ACI)
          </Label>
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? "جاري الإضافة..." : "+ إضافة بوابة"}
        </Button>
      </div>

      {requirements.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground">المتطلبات الحاجبة لهذه البوابة (لازم تكون Met/غير منطبق قبل ما تعدّي)</p>
          <div className="mt-2 flex flex-wrap gap-3">
            {requirements.map((r) => (
              <div key={r.id} className="flex items-center gap-1.5">
                <Checkbox id={`block-${r.id}`} name="blockingRequirementIds" value={r.id} />
                <Label htmlFor={`block-${r.id}`} className="text-xs font-normal">
                  {r.name}
                </Label>
              </div>
            ))}
          </div>
        </div>
      )}
      {state.formError && <p role="alert" className="text-sm text-destructive">{state.formError}</p>}
    </form>
  );
}
