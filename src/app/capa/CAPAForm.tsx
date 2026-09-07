"use client";

import { useActionState } from "react";
import { createCAPA, type CAPAFormState } from "./actions";
import { capaRootCauseMethodLabel } from "@/lib/capaLabels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const initialState: CAPAFormState = {};
const rootCauseMethods = Object.keys(capaRootCauseMethodLabel);

export default function CAPAForm() {
  const [state, formAction, pending] = useActionState(createCAPA, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="rootCause" className="text-xs">
          السبب الجذري
        </Label>
        <Input id="rootCause" name="rootCause" className="w-40" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="rootCauseMethod" className="text-xs">
          طريقة التحليل
        </Label>
        <Select name="rootCauseMethod">
          <SelectTrigger id="rootCauseMethod" className="w-40">
            <SelectValue placeholder="—">{(value: string) => capaRootCauseMethodLabel[value] ?? value}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {rootCauseMethods.map((m) => (
              <SelectItem key={m} value={m}>
                {capaRootCauseMethodLabel[m]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="correctiveAction" className="text-xs">
          الإجراء التصحيحي
        </Label>
        <Input id="correctiveAction" name="correctiveAction" className="w-40" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="preventiveAction" className="text-xs">
          الإجراء الوقائي
        </Label>
        <Input id="preventiveAction" name="preventiveAction" className="w-40" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="dueDate" className="text-xs">
          تاريخ الاستحقاق
        </Label>
        <Input id="dueDate" name="dueDate" type="date" className="w-40" />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "جاري الإضافة..." : "+ إجراء تصحيحي"}
      </Button>
      {state.formError && <p role="alert" className="w-full text-sm text-destructive">{state.formError}</p>}
    </form>
  );
}
