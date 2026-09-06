"use client";

import { useActionState } from "react";
import { createFacility, type FacilityFormState } from "../actions";
import { facilityTypeLabel, facilityStatusLabel } from "@/lib/procurementLabels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const initialState: FacilityFormState = {};
const types = Object.keys(facilityTypeLabel);
const statuses = Object.keys(facilityStatusLabel);

export default function FacilityForm({ supplierId }: { supplierId: string }) {
  const action = createFacility.bind(null, supplierId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="facilityType" className="text-xs">
          نوع المنشأة
        </Label>
        <Select name="facilityType" defaultValue={types[0]}>
          <SelectTrigger id="facilityType" className="w-40">
            <SelectValue>{(value: string) => facilityTypeLabel[value] ?? value}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {types.map((t) => (
              <SelectItem key={t} value={t}>
                {facilityTypeLabel[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="f-name" className="text-xs">
          اسم المنشأة *
        </Label>
        <Input id="f-name" name="name" className="w-36" />
        {state.errors?.name && <span className="text-xs text-destructive">{state.errors.name[0]}</span>}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="address" className="text-xs">
          العنوان
        </Label>
        <Input id="address" name="address" className="w-40" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="capacityDaily" className="text-xs">
          الطاقة اليومية
        </Label>
        <Input id="capacityDaily" name="capacityDaily" type="number" min="0" step="0.01" className="w-28" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="productionLines" className="text-xs">
          خطوط الإنتاج
        </Label>
        <Input id="productionLines" name="productionLines" type="number" min="0" className="w-20" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="shifts" className="text-xs">
          الورديات
        </Label>
        <Input id="shifts" name="shifts" type="number" min="0" className="w-20" />
      </div>
      <div className="flex items-center gap-1.5">
        <Checkbox id="hasTraceabilitySystem" name="hasTraceabilitySystem" />
        <Label htmlFor="hasTraceabilitySystem" className="text-xs font-normal">
          نظام تتبّع
        </Label>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="f-status" className="text-xs">
          الحالة
        </Label>
        <Select name="status" defaultValue={statuses[1]}>
          <SelectTrigger id="f-status" className="w-32">
            <SelectValue>{(value: string) => facilityStatusLabel[value] ?? value}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {statuses.map((s) => (
              <SelectItem key={s} value={s}>
                {facilityStatusLabel[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "جاري الإضافة..." : "+ منشأة"}
      </Button>
      {state.formError && <p role="alert" className="w-full text-sm text-destructive">{state.formError}</p>}
    </form>
  );
}
