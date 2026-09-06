"use client";

import { useActionState } from "react";
import { createLogisticsException, type LogisticsExceptionFormState } from "../actions";
import { logisticsExceptionTypeLabel, logisticsExceptionSeverityLabel } from "@/lib/logisticsLabels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const initialState: LogisticsExceptionFormState = {};
const types = Object.keys(logisticsExceptionTypeLabel);
const severities = Object.keys(logisticsExceptionSeverityLabel);

export default function LogisticsExceptionForm({ shipmentId }: { shipmentId: string }) {
  const action = createLogisticsException.bind(null, shipmentId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="exceptionType" className="text-xs">
          نوع الاستثناء
        </Label>
        <Select name="exceptionType" defaultValue={types[0]}>
          <SelectTrigger id="exceptionType" className="w-44">
            <SelectValue>{(value: string) => logisticsExceptionTypeLabel[value] ?? value}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {types.map((t) => (
              <SelectItem key={t} value={t}>
                {logisticsExceptionTypeLabel[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="severity" className="text-xs">
          الخطورة
        </Label>
        <Select name="severity" defaultValue="Medium">
          <SelectTrigger id="severity" className="w-32">
            <SelectValue>{(value: string) => logisticsExceptionSeverityLabel[value] ?? value}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {severities.map((s) => (
              <SelectItem key={s} value={s}>
                {logisticsExceptionSeverityLabel[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="detectedAt" className="text-xs">
          تاريخ الاكتشاف *
        </Label>
        <Input id="detectedAt" name="detectedAt" type="datetime-local" className="w-52" />
        {state.errors?.detectedAt && <span className="text-xs text-destructive">{state.errors.detectedAt[0]}</span>}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="rootCause" className="text-xs">
          السبب الجذري
        </Label>
        <Input id="rootCause" name="rootCause" className="w-40" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="financialExposure" className="text-xs">
          التعرّض المالي
        </Label>
        <Input id="financialExposure" name="financialExposure" type="number" min="0" step="0.01" className="w-28" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="scheduleImpactDays" className="text-xs">
          تأثير الجدول (أيام)
        </Label>
        <Input id="scheduleImpactDays" name="scheduleImpactDays" type="number" min="0" className="w-24" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="recoveryPlan" className="text-xs">
          خطة المعالجة
        </Label>
        <Input id="recoveryPlan" name="recoveryPlan" className="w-40" />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "جاري التسجيل..." : "+ استثناء"}
      </Button>
      {state.formError && <p role="alert" className="w-full text-sm text-destructive">{state.formError}</p>}
    </form>
  );
}
