"use client";

import { useActionState } from "react";
import { createFreeTimeRecord, type FreeTimeRecordFormState } from "../actions";
import { freeTimeChargeTypeLabel, freeTimeLocationLabel } from "@/lib/logisticsLabels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const initialState: FreeTimeRecordFormState = {};
const chargeTypes = Object.keys(freeTimeChargeTypeLabel);
const locations = Object.keys(freeTimeLocationLabel);

export default function FreeTimeRecordForm({
  shipmentId,
  containers,
}: {
  shipmentId: string;
  containers: { id: string; containerNumber: string | null }[];
}) {
  const action = createFreeTimeRecord.bind(null, shipmentId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
      {containers.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="containerId" className="text-xs">
            الحاوية
          </Label>
          <Select name="containerId">
            <SelectTrigger id="containerId" className="w-40">
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
        <Label htmlFor="chargeType" className="text-xs">
          نوع الغرامة
        </Label>
        <Select name="chargeType" defaultValue={chargeTypes[0]}>
          <SelectTrigger id="chargeType" className="w-40">
            <SelectValue>{(value: string) => freeTimeChargeTypeLabel[value] ?? value}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {chargeTypes.map((t) => (
              <SelectItem key={t} value={t}>
                {freeTimeChargeTypeLabel[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ft-location" className="text-xs">
          الموقع
        </Label>
        <Select name="location" defaultValue={locations[0]}>
          <SelectTrigger id="ft-location" className="w-28">
            <SelectValue>{(value: string) => freeTimeLocationLabel[value] ?? value}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {locations.map((l) => (
              <SelectItem key={l} value={l}>
                {freeTimeLocationLabel[l]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="freeDays" className="text-xs">
          أيام السماح
        </Label>
        <Input id="freeDays" name="freeDays" type="number" min="0" className="w-20" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ft-startDate" className="text-xs">
          تاريخ البداية
        </Label>
        <Input id="ft-startDate" name="startDate" type="date" className="w-40" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ft-endDate" className="text-xs">
          تاريخ النهاية
        </Label>
        <Input id="ft-endDate" name="endDate" type="date" className="w-40" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="estimatedCost" className="text-xs">
          التكلفة المتوقعة
        </Label>
        <Input id="estimatedCost" name="estimatedCost" type="number" min="0" step="0.01" className="w-28" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="actualCost" className="text-xs">
          التكلفة الفعلية
        </Label>
        <Input id="actualCost" name="actualCost" type="number" min="0" step="0.01" className="w-28" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ft-currency" className="text-xs">
          العملة
        </Label>
        <Input id="ft-currency" name="currency" className="w-20" placeholder="USD" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="responsibleParty" className="text-xs">
          الطرف المسؤول
        </Label>
        <Input id="responsibleParty" name="responsibleParty" className="w-32" />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "جاري التسجيل..." : "+ سجل"}
      </Button>
      {state.formError && <p role="alert" className="w-full text-sm text-destructive">{state.formError}</p>}
    </form>
  );
}
