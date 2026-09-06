"use client";

import { useActionState } from "react";
import { addShipmentLot, type ShipmentLotFormState } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const initialState: ShipmentLotFormState = {};

export default function ShipmentLotForm({ shipmentId, lots }: { shipmentId: string; lots: { id: string; lotCode: string }[] }) {
  const action = addShipmentLot.bind(null, shipmentId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="lotId" className="text-xs">
          الدفعة (Lot) *
        </Label>
        <Select name="lotId">
          <SelectTrigger id="lotId" className="w-40">
            <SelectValue placeholder="اختر دفعة">{(value: string) => lots.find((l) => l.id === value)?.lotCode ?? value}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {lots.map((l) => (
              <SelectItem key={l.id} value={l.id}>
                {l.lotCode}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {state.errors?.lotId && <span className="text-xs text-destructive">{state.errors.lotId[0]}</span>}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="sl-quantity" className="text-xs">
          الكمية
        </Label>
        <Input id="sl-quantity" name="quantity" type="number" min="0" step="0.001" className="w-24" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="sl-cartons" className="text-xs">
          الكراتين
        </Label>
        <Input id="sl-cartons" name="cartons" type="number" min="0" className="w-20" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="sl-netWeight" className="text-xs">
          الوزن الصافي
        </Label>
        <Input id="sl-netWeight" name="netWeight" type="number" min="0" step="0.001" className="w-24" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="sl-grossWeight" className="text-xs">
          الوزن القائم
        </Label>
        <Input id="sl-grossWeight" name="grossWeight" type="number" min="0" step="0.001" className="w-24" />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "جاري الربط..." : "+ ربط دفعة"}
      </Button>
      {state.formError && <p role="alert" className="w-full text-sm text-destructive">{state.formError}</p>}
    </form>
  );
}
