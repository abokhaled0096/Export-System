"use client";

import { useActionState } from "react";
import { createShipment, type ShipmentFormState } from "./actions";
import { shipmentTypeLabel, transportModeLabel, loadTypeLabel } from "@/lib/logisticsLabels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form } from "@/components/ui/form";

const initialState: ShipmentFormState = {};
const shipmentTypes = Object.keys(shipmentTypeLabel);
const transportModes = Object.keys(transportModeLabel);
const loadTypes = Object.keys(loadTypeLabel);
const incoterms = ["EXW", "FCA", "FAS", "FOB", "CFR", "CIF", "CPT", "CIP", "DAP", "DPU", "DDP"];

export default function ShipmentCreateForm({ dealId, complianceCaseId }: { dealId: string; complianceCaseId?: string }) {
  const action = createShipment.bind(null, dealId, complianceCaseId ?? null);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <Form action={formAction} state={state} className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="shipmentType" className="text-xs">
          نوع الشحنة
        </Label>
        <Select name="shipmentType" defaultValue={shipmentTypes[0]}>
          <SelectTrigger id="shipmentType" className="w-32">
            <SelectValue>{(value: string) => shipmentTypeLabel[value] ?? value}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {shipmentTypes.map((t) => (
              <SelectItem key={t} value={t}>
                {shipmentTypeLabel[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="transportMode" className="text-xs">
          وسيلة النقل
        </Label>
        <Select name="transportMode" defaultValue={transportModes[0]}>
          <SelectTrigger id="transportMode" className="w-32">
            <SelectValue>{(value: string) => transportModeLabel[value] ?? value}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {transportModes.map((t) => (
              <SelectItem key={t} value={t}>
                {transportModeLabel[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="loadType" className="text-xs">
          نوع الحمولة
        </Label>
        <Select name="loadType">
          <SelectTrigger id="loadType" className="w-36">
            <SelectValue placeholder="—">{(value: string) => loadTypeLabel[value] ?? value}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {loadTypes.map((t) => (
              <SelectItem key={t} value={t}>
                {loadTypeLabel[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="incoterm" className="text-xs">
          Incoterm
        </Label>
        <Select name="incoterm" defaultValue="FOB">
          <SelectTrigger id="incoterm" className="w-24">
            <SelectValue>{(value: string) => value}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {incoterms.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="originPort" className="text-xs">
          ميناء المنشأ *
        </Label>
        <Input id="originPort" name="originPort" className="w-32" placeholder="الإسكندرية" />
        {state.errors?.originPort && <span className="text-xs text-destructive">{state.errors.originPort[0]}</span>}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="destinationPort" className="text-xs">
          ميناء الوصول *
        </Label>
        <Input id="destinationPort" name="destinationPort" className="w-32" placeholder="روتردام" />
        {state.errors?.destinationPort && <span className="text-xs text-destructive">{state.errors.destinationPort[0]}</span>}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="finalDestination" className="text-xs">
          الوجهة النهائية
        </Label>
        <Input id="finalDestination" name="finalDestination" className="w-32" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="cargoReadyDate" className="text-xs">
          جاهزية البضاعة
        </Label>
        <Input id="cargoReadyDate" name="cargoReadyDate" type="date" className="w-40" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="etd" className="text-xs">
          موعد المغادرة (ETD)
        </Label>
        <Input id="etd" name="etd" type="date" className="w-40" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="eta" className="text-xs">
          موعد الوصول (ETA)
        </Label>
        <Input id="eta" name="eta" type="date" className="w-40" />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "جاري الإنشاء..." : "+ إنشاء شحنة"}
      </Button>
      {state.formError && <p role="alert" className="w-full text-sm text-destructive">{state.formError}</p>}
    </Form>
  );
}
