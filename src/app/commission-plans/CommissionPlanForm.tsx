"use client";

import { useActionState, useState } from "react";
import { createCommissionPlan, type CommissionPlanFormState } from "./actions";
import { commissionBasisLabel, commissionTriggerEventLabel } from "@/lib/commissionLabels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form } from "@/components/ui/form";

const initialState: CommissionPlanFormState = {};
const bases = Object.keys(commissionBasisLabel);
const triggerEvents = Object.keys(commissionTriggerEventLabel);

export default function CommissionPlanForm() {
  const [state, formAction, pending] = useActionState(createCommissionPlan, initialState);
  const [basis, setBasis] = useState(bases[0]);
  const isTiered = basis === "Tiered";

  return (
    <Form action={formAction} state={state} className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="name" className="text-xs">
            اسم الخطة *
          </Label>
          <Input id="name" name="name" className="w-40" />
          {state.errors?.name && <span className="text-xs text-destructive">{state.errors.name[0]}</span>}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="basis" className="text-xs">
            الأساس
          </Label>
          <Select name="basis" value={basis} onValueChange={(v) => setBasis(v ?? bases[0])}>
            <SelectTrigger id="basis" className="w-40">
              <SelectValue>{(value: string) => commissionBasisLabel[value] ?? value}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {bases.map((b) => (
                <SelectItem key={b} value={b}>
                  {commissionBasisLabel[b]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {!isTiered && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ratePct" className="text-xs">
              النسبة %
            </Label>
            <Input id="ratePct" name="ratePct" type="number" min="0" max="100" step="0.01" className="w-24" />
            {state.errors?.ratePct && <span className="text-xs text-destructive">{state.errors.ratePct[0]}</span>}
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="triggerEvent" className="text-xs">
            يُستحق عند
          </Label>
          <Select name="triggerEvent" defaultValue={triggerEvents[0]}>
            <SelectTrigger id="triggerEvent" className="w-40">
              <SelectValue>{(value: string) => commissionTriggerEventLabel[value] ?? value}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {triggerEvents.map((t) => (
                <SelectItem key={t} value={t}>
                  {commissionTriggerEventLabel[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {!isTiered && (
          <Button type="submit" disabled={pending}>
            {pending ? "جاري الإضافة..." : "+ خطة عمولة"}
          </Button>
        )}
      </div>

      {isTiered && (
        <div className="flex flex-col gap-2 border-t border-border pt-3">
          <p className="text-xs text-muted-foreground">
            حدّد لغاية 3 شرايح (من مبلغ — لحد مبلغ اختياري، فاضي = &quot;وما فوق&quot; — بنسبة %). الحساب التلقائي مش مدعوم للأساس ده حاليًا — العمولة بتتسجّل يدويًا، والشرايح دي مرجع أثناء التسجيل بس.
          </p>
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`tier${i}Min`} className="text-xs">
                  شريحة {i} — من
                </Label>
                <Input id={`tier${i}Min`} name={`tier${i}Min`} type="number" min="0" step="0.01" className="w-28" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`tier${i}Max`} className="text-xs">
                  لحد (فاضي = وما فوق)
                </Label>
                <Input id={`tier${i}Max`} name={`tier${i}Max`} type="number" min="0" step="0.01" className="w-28" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`tier${i}Rate`} className="text-xs">
                  النسبة %
                </Label>
                <Input id={`tier${i}Rate`} name={`tier${i}Rate`} type="number" min="0" max="100" step="0.01" className="w-24" />
              </div>
            </div>
          ))}
          <Button type="submit" disabled={pending} className="w-fit">
            {pending ? "جاري الإضافة..." : "+ خطة عمولة"}
          </Button>
        </div>
      )}

      {state.formError && <p role="alert" className="w-full text-sm text-destructive">{state.formError}</p>}
    </Form>
  );
}
