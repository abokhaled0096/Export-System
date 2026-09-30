"use client";

import { useActionState } from "react";
import { createBatchRawMaterialLine, type BatchRawMaterialLineFormState } from "../actions";
import { batchRawMaterialSourceTypeLabel } from "@/lib/procurementLabels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form } from "@/components/ui/form";

const initialState: BatchRawMaterialLineFormState = {};
const sourceTypes = Object.keys(batchRawMaterialSourceTypeLabel);

export default function BatchRawMaterialLineForm({
  batchId,
  farms,
  inventoryRecords,
}: {
  batchId: string;
  farms: { id: string; farmerName: string | null; crop: string | null }[];
  inventoryRecords: { id: string; label: string }[];
}) {
  const action = createBatchRawMaterialLine.bind(null, batchId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <Form action={formAction} state={state} className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="sourceType" className="text-xs">
          نوع المصدر *
        </Label>
        <Select name="sourceType" defaultValue={sourceTypes[0]}>
          <SelectTrigger id="sourceType" className="w-32">
            <SelectValue>{(value: string) => batchRawMaterialSourceTypeLabel[value] ?? value}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {sourceTypes.map((t) => (
              <SelectItem key={t} value={t}>
                {batchRawMaterialSourceTypeLabel[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {farms.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="farmId" className="text-xs">
            المزرعة
          </Label>
          <Select name="farmId">
            <SelectTrigger id="farmId" className="w-36">
              <SelectValue placeholder="—">
                {(value: string) => {
                  const f = farms.find((x) => x.id === value);
                  return f ? `${f.farmerName ?? "—"} (${f.crop ?? "—"})` : value;
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {farms.map((f) => (
                <SelectItem key={f.id} value={f.id}>
                  {f.farmerName ?? "—"} ({f.crop ?? "—"})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {state.errors?.farmId && <span className="text-xs text-destructive">{state.errors.farmId[0]}</span>}
        </div>
      )}
      {inventoryRecords.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="inventoryId" className="text-xs">
            سجل المخزون
          </Label>
          <Select name="inventoryId">
            <SelectTrigger id="inventoryId" className="w-36">
              <SelectValue placeholder="—">{(value: string) => inventoryRecords.find((i) => i.id === value)?.label ?? value}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {inventoryRecords.map((i) => (
                <SelectItem key={i.id} value={i.id}>
                  {i.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {state.errors?.inventoryId && <span className="text-xs text-destructive">{state.errors.inventoryId[0]}</span>}
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="brml-quantity" className="text-xs">
          الكمية
        </Label>
        <Input id="brml-quantity" name="quantity" type="number" min="0" step="0.001" className="w-24" />
      </div>
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? "جاري الإضافة..." : "+ مصدر خام"}
      </Button>
      {state.formError && <p role="alert" className="w-full text-sm text-destructive">{state.formError}</p>}
    </Form>
  );
}
