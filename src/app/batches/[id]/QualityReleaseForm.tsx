"use client";

import { useActionState } from "react";
import { createQualityRelease, type QualityReleaseFormState } from "../actions";
import { qualityReleaseStatusLabel } from "@/lib/procurementLabels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form } from "@/components/ui/form";

const initialState: QualityReleaseFormState = {};
const statuses = Object.keys(qualityReleaseStatusLabel);

export default function QualityReleaseForm({ batchId }: { batchId: string }) {
  const action = createQualityRelease.bind(null, batchId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <Form action={formAction} state={state} className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="releasedQuantity" className="text-xs">
          الكمية المُفرَج عنها
        </Label>
        <Input id="releasedQuantity" name="releasedQuantity" type="number" min="0" step="0.001" className="w-28" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="rejectedQuantity" className="text-xs">
          الكمية المرفوضة
        </Label>
        <Input id="rejectedQuantity" name="rejectedQuantity" type="number" min="0" step="0.001" className="w-28" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="qr-status" className="text-xs">
          الحالة *
        </Label>
        <Select name="status" defaultValue={statuses[0]}>
          <SelectTrigger id="qr-status" className="w-40">
            <SelectValue>{(value: string) => qualityReleaseStatusLabel[value] ?? value}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {statuses.map((s) => (
              <SelectItem key={s} value={s}>
                {qualityReleaseStatusLabel[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? "جاري التسجيل..." : "+ إفراج جودة"}
      </Button>
      {state.formError && <p role="alert" className="w-full text-sm text-destructive">{state.formError}</p>}
    </Form>
  );
}
