"use client";

import { useActionState } from "react";
import { createInspection, type InspectionFormState } from "../actions";
import { inspectionStageLabel, inspectionResultLabel } from "@/lib/procurementLabels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form } from "@/components/ui/form";

const initialState: InspectionFormState = {};
const stages = Object.keys(inspectionStageLabel);
const results = Object.keys(inspectionResultLabel);

export default function InspectionForm({ batchId }: { batchId: string }) {
  const action = createInspection.bind(null, batchId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <Form action={formAction} state={state} className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="stage" className="text-xs">
          مرحلة الفحص *
        </Label>
        <Select name="stage" defaultValue={stages[0]}>
          <SelectTrigger id="stage" className="w-44">
            <SelectValue>{(value: string) => inspectionStageLabel[value] ?? value}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {stages.map((s) => (
              <SelectItem key={s} value={s}>
                {inspectionStageLabel[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="samplingMethod" className="text-xs">
          طريقة المعاينة
        </Label>
        <Input id="samplingMethod" name="samplingMethod" className="w-36" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="sampleSize" className="text-xs">
          حجم العيّنة
        </Label>
        <Input id="sampleSize" name="sampleSize" type="number" min="0" step="0.01" className="w-24" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="result" className="text-xs">
          النتيجة *
        </Label>
        <Select name="result" defaultValue={results[0]}>
          <SelectTrigger id="result" className="w-32">
            <SelectValue>{(value: string) => inspectionResultLabel[value] ?? value}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {results.map((r) => (
              <SelectItem key={r} value={r}>
                {inspectionResultLabel[r]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? "جاري التسجيل..." : "+ فحص"}
      </Button>
      {state.formError && <p role="alert" className="w-full text-sm text-destructive">{state.formError}</p>}
    </Form>
  );
}
