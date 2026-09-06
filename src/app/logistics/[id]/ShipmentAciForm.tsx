"use client";

import { useActionState } from "react";
import { updateShipmentAci, type ShipmentAciFormState } from "../actions";
import { aciStatusLabel } from "@/lib/logisticsLabels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const initialState: ShipmentAciFormState = {};
const statuses = Object.keys(aciStatusLabel);

export default function ShipmentAciForm({
  shipmentId,
  acidNumber,
  aciStatus,
  aciSubmittedAt,
}: {
  shipmentId: string;
  acidNumber: string | null;
  aciStatus: string;
  aciSubmittedAt: string | null;
}) {
  const action = updateShipmentAci.bind(null, shipmentId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="acidNumber" className="text-xs">
          رقم ACID
        </Label>
        <Input id="acidNumber" name="acidNumber" defaultValue={acidNumber ?? ""} className="w-40" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="aciStatus" className="text-xs">
          حالة ACI
        </Label>
        <Select name="aciStatus" defaultValue={aciStatus}>
          <SelectTrigger id="aciStatus" className="w-36">
            <SelectValue>{(value: string) => aciStatusLabel[value] ?? value}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {statuses.map((s) => (
              <SelectItem key={s} value={s}>
                {aciStatusLabel[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="aciSubmittedAt" className="text-xs">
          تاريخ تقديم ACID
        </Label>
        <Input id="aciSubmittedAt" name="aciSubmittedAt" type="datetime-local" defaultValue={aciSubmittedAt ?? ""} className="w-52" />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "جاري الحفظ..." : "تحديث ACI"}
      </Button>
      {state.formError && <p role="alert" className="w-full text-sm text-destructive">{state.formError}</p>}
    </form>
  );
}
