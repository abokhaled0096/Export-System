"use client";

import { useActionState } from "react";
import { addContainer, type ContainerFormState } from "../actions";
import { containerTypeLabel } from "@/lib/logisticsLabels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const initialState: ContainerFormState = {};
const types = Object.keys(containerTypeLabel);

export default function ContainerForm({ shipmentId }: { shipmentId: string }) {
  const action = addContainer.bind(null, shipmentId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="containerNumber" className="text-xs">
          رقم الحاوية
        </Label>
        <Input id="containerNumber" name="containerNumber" className="w-32" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="containerType" className="text-xs">
          النوع
        </Label>
        <Select name="containerType" defaultValue={types[0]}>
          <SelectTrigger id="containerType" className="w-36">
            <SelectValue>{(value: string) => containerTypeLabel[value] ?? value}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {types.map((t) => (
              <SelectItem key={t} value={t}>
                {containerTypeLabel[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="sealNumber" className="text-xs">
          رقم الختم
        </Label>
        <Input id="sealNumber" name="sealNumber" className="w-32" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="maxPayload" className="text-xs">
          أقصى حمولة (كجم)
        </Label>
        <Input id="maxPayload" name="maxPayload" type="number" min="0" step="0.01" className="w-28" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="netWeight" className="text-xs">
          الوزن الصافي (كجم)
        </Label>
        <Input id="netWeight" name="netWeight" type="number" min="0" step="0.01" className="w-28" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="grossWeight" className="text-xs">
          الوزن القائم (كجم)
        </Label>
        <Input id="grossWeight" name="grossWeight" type="number" min="0" step="0.01" className="w-28" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="usedVolume" className="text-xs">
          الحجم المستخدم (م³)
        </Label>
        <Input id="usedVolume" name="usedVolume" type="number" min="0" step="0.001" className="w-28" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="availableVolume" className="text-xs">
          الحجم المتاح (م³)
        </Label>
        <Input id="availableVolume" name="availableVolume" type="number" min="0" step="0.001" className="w-28" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="setPointTempC" className="text-xs">
          درجة الحرارة المضبوطة (°م)
        </Label>
        <Input id="setPointTempC" name="setPointTempC" type="number" step="0.1" className="w-24" />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "جاري الإضافة..." : "+ حاوية"}
      </Button>
      {state.formError && <p role="alert" className="w-full text-sm text-destructive">{state.formError}</p>}
    </form>
  );
}
