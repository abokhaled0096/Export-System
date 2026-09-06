"use client";

import { useActionState } from "react";
import { createRedFlag, type RedFlagFormState } from "../actions";
import { redFlagSeverityLabel } from "@/lib/redFlagLabels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const initialState: RedFlagFormState = {};
const severities = Object.keys(redFlagSeverityLabel);

export default function RedFlagForm({ companyId }: { companyId: string }) {
  const action = createRedFlag.bind(null, companyId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="flagType" className="text-xs">
          نوع العلم *
        </Label>
        <Input id="flagType" name="flagType" className="w-36" />
        {state.errors?.flagType && <span className="text-xs text-destructive">{state.errors.flagType[0]}</span>}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="severity" className="text-xs">
          الخطورة
        </Label>
        <Select name="severity" defaultValue={severities[1]}>
          <SelectTrigger id="severity" className="w-28">
            <SelectValue>{(value: string) => redFlagSeverityLabel[value] ?? value}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {severities.map((s) => (
              <SelectItem key={s} value={s}>
                {redFlagSeverityLabel[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="description" className="text-xs">
          الوصف
        </Label>
        <Input id="description" name="description" className="w-56" />
      </div>
      <div className="flex items-center gap-1.5">
        <Checkbox id="blocksDealing" name="blocksDealing" />
        <Label htmlFor="blocksDealing" className="text-xs font-normal">
          يمنع التعامل
        </Label>
      </div>
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? "جاري الإضافة..." : "+ علم تحذيري"}
      </Button>
      {state.formError && <p role="alert" className="w-full text-sm text-destructive">{state.formError}</p>}
    </form>
  );
}
