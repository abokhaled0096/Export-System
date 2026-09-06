"use client";

import { useActionState } from "react";
import { addShipmentEvent, type ShipmentEventFormState } from "../actions";
import { shipmentEventSourceLabel } from "@/lib/logisticsLabels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const initialState: ShipmentEventFormState = {};
const sources = Object.keys(shipmentEventSourceLabel);

export default function ShipmentEventForm({ shipmentId }: { shipmentId: string }) {
  const action = addShipmentEvent.bind(null, shipmentId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="eventType" className="text-xs">
          نوع الحدث *
        </Label>
        <Input id="eventType" name="eventType" className="w-40" placeholder="غادرت الميناء" />
        {state.errors?.eventType && <span className="text-xs text-destructive">{state.errors.eventType[0]}</span>}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="occurredAt" className="text-xs">
          تاريخ الحدث *
        </Label>
        <Input id="occurredAt" name="occurredAt" type="datetime-local" className="w-52" />
        {state.errors?.occurredAt && <span className="text-xs text-destructive">{state.errors.occurredAt[0]}</span>}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="location" className="text-xs">
          الموقع
        </Label>
        <Input id="location" name="location" className="w-32" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="source" className="text-xs">
          المصدر
        </Label>
        <Select name="source" defaultValue={sources[0]}>
          <SelectTrigger id="source" className="w-40">
            <SelectValue>{(value: string) => shipmentEventSourceLabel[value] ?? value}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {sources.map((s) => (
              <SelectItem key={s} value={s}>
                {shipmentEventSourceLabel[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="reliability" className="text-xs">
          نسبة الثقة %
        </Label>
        <Input id="reliability" name="reliability" type="number" min="0" max="100" className="w-20" />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "جاري التسجيل..." : "+ حدث"}
      </Button>
      {state.formError && <p role="alert" className="w-full text-sm text-destructive">{state.formError}</p>}
    </form>
  );
}
