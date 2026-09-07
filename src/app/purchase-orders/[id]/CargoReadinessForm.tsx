"use client";

import { useActionState } from "react";
import { createCargoReadiness, type CargoReadinessFormState } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const initialState: CargoReadinessFormState = {};

export default function CargoReadinessForm({
  purchaseOrderId,
  shipments,
}: {
  purchaseOrderId: string;
  shipments: { id: string; label: string }[];
}) {
  const action = createCargoReadiness.bind(null, purchaseOrderId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="shipmentId" className="text-xs">
          الشحنة *
        </Label>
        <Select name="shipmentId">
          <SelectTrigger id="shipmentId" className="w-48">
            <SelectValue placeholder="اختر شحنة">{(value: string) => shipments.find((s) => s.id === value)?.label ?? value}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {shipments.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {state.errors?.shipmentId && <span className="text-xs text-destructive">{state.errors.shipmentId[0]}</span>}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="readinessScore" className="text-xs">
          درجة الجاهزية
        </Label>
        <Input id="readinessScore" name="readinessScore" type="number" min="0" max="100" step="0.01" className="w-24" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="readyDate" className="text-xs">
          تاريخ الجاهزية
        </Label>
        <Input id="readyDate" name="readyDate" type="date" className="w-40" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="pickupLocation" className="text-xs">
          موقع الاستلام
        </Label>
        <Input id="pickupLocation" name="pickupLocation" className="w-32" />
      </div>
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? "جاري الإضافة..." : "+ جاهزية شحن"}
      </Button>
      {state.formError && <p role="alert" className="w-full text-sm text-destructive">{state.formError}</p>}
    </form>
  );
}
