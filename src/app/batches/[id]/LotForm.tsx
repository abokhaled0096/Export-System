"use client";

import { useActionState } from "react";
import { createLot, type LotFormState } from "../actions";
import { batchQualityStatusLabel } from "@/lib/procurementLabels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form } from "@/components/ui/form";

const initialState: LotFormState = {};
const qualityStatuses = Object.keys(batchQualityStatusLabel);

export default function LotForm({ batchId }: { batchId: string }) {
  const action = createLot.bind(null, batchId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <Form action={formAction} state={state} className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="lotCode" className="text-xs">
          كود الـLot *
        </Label>
        <Input id="lotCode" name="lotCode" className="w-32" />
        {state.errors?.lotCode && <span className="text-xs text-destructive">{state.errors.lotCode[0]}</span>}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="packingDate" className="text-xs">
          تاريخ التعبئة
        </Label>
        <Input id="packingDate" name="packingDate" type="date" className="w-40" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="quantity" className="text-xs">
          الكمية
        </Label>
        <Input id="quantity" name="quantity" type="number" min="0" step="0.001" className="w-24" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="cartons" className="text-xs">
          الكراتين
        </Label>
        <Input id="cartons" name="cartons" type="number" min="0" className="w-20" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="pallets" className="text-xs">
          الطبليات
        </Label>
        <Input id="pallets" name="pallets" type="number" min="0" className="w-20" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="netWeight" className="text-xs">
          الوزن الصافي
        </Label>
        <Input id="netWeight" name="netWeight" type="number" min="0" step="0.001" className="w-24" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="grossWeight" className="text-xs">
          الوزن القائم
        </Label>
        <Input id="grossWeight" name="grossWeight" type="number" min="0" step="0.001" className="w-24" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="lot-qualityStatus" className="text-xs">
          حالة الجودة *
        </Label>
        <Select name="qualityStatus" defaultValue={qualityStatuses[0]}>
          <SelectTrigger id="lot-qualityStatus" className="w-32">
            <SelectValue>{(value: string) => batchQualityStatusLabel[value] ?? value}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {qualityStatuses.map((s) => (
              <SelectItem key={s} value={s}>
                {batchQualityStatusLabel[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "جاري الإضافة..." : "+ Lot"}
      </Button>
      {state.formError && <p role="alert" className="w-full text-sm text-destructive">{state.formError}</p>}
    </Form>
  );
}
