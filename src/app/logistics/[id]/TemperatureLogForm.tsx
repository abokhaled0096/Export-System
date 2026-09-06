"use client";

import { useActionState } from "react";
import { addTemperatureLog, type TemperatureLogFormState } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const initialState: TemperatureLogFormState = {};

export default function TemperatureLogForm({
  shipmentId,
  containers,
}: {
  shipmentId: string;
  containers: { id: string; containerNumber: string | null }[];
}) {
  const action = addTemperatureLog.bind(null, shipmentId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
      {containers.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="tl-containerId" className="text-xs">
            الحاوية
          </Label>
          <Select name="containerId">
            <SelectTrigger id="tl-containerId" className="w-40">
              <SelectValue placeholder="—">{(value: string) => containers.find((c) => c.id === value)?.containerNumber ?? value}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {containers.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.containerNumber ?? c.id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="recordedAt" className="text-xs">
          تاريخ القراءة *
        </Label>
        <Input id="recordedAt" name="recordedAt" type="datetime-local" className="w-52" />
        {state.errors?.recordedAt && <span className="text-xs text-destructive">{state.errors.recordedAt[0]}</span>}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="temperatureC" className="text-xs">
          الحرارة (°م) *
        </Label>
        <Input id="temperatureC" name="temperatureC" type="number" step="0.1" className="w-24" />
        {state.errors?.temperatureC && <span className="text-xs text-destructive">{state.errors.temperatureC[0]}</span>}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="humidityPct" className="text-xs">
          الرطوبة %
        </Label>
        <Input id="humidityPct" name="humidityPct" type="number" min="0" max="100" className="w-20" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="deviceId" className="text-xs">
          رقم الجهاز
        </Label>
        <Input id="deviceId" name="deviceId" className="w-28" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="tl-source" className="text-xs">
          المصدر
        </Label>
        <Input id="tl-source" name="source" className="w-28" />
      </div>
      <div className="flex items-center gap-1.5">
        <Checkbox id="isExcursion" name="isExcursion" />
        <Label htmlFor="isExcursion" className="text-xs font-normal">
          تجاوز حراري
        </Label>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "جاري التسجيل..." : "+ قراءة"}
      </Button>
      {state.formError && <p role="alert" className="w-full text-sm text-destructive">{state.formError}</p>}
    </form>
  );
}
