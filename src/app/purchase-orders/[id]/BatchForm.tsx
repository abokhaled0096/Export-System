"use client";

import { useActionState } from "react";
import { createBatch, type BatchFormState } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form } from "@/components/ui/form";

const initialState: BatchFormState = {};

export default function BatchForm({
  purchaseOrderId,
  facilities,
}: {
  purchaseOrderId: string;
  facilities: { id: string; name: string }[];
}) {
  const action = createBatch.bind(null, purchaseOrderId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <Form action={formAction} state={state} className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="batch-facilityId" className="text-xs">
          المنشأة *
        </Label>
        <Select name="facilityId">
          <SelectTrigger id="batch-facilityId" className="w-40">
            <SelectValue placeholder="اختر منشأة">{(value: string) => facilities.find((f) => f.id === value)?.name ?? value}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {facilities.map((f) => (
              <SelectItem key={f.id} value={f.id}>
                {f.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {state.errors?.facilityId && <span className="text-xs text-destructive">{state.errors.facilityId[0]}</span>}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="batchCode" className="text-xs">
          كود الدفعة *
        </Label>
        <Input id="batchCode" name="batchCode" className="w-32" />
        {state.errors?.batchCode && <span className="text-xs text-destructive">{state.errors.batchCode[0]}</span>}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="productionDate" className="text-xs">
          تاريخ الإنتاج
        </Label>
        <Input id="productionDate" name="productionDate" type="date" className="w-40" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="expiryDate" className="text-xs">
          تاريخ الانتهاء
        </Label>
        <Input id="expiryDate" name="expiryDate" type="date" className="w-40" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="quantityInput" className="text-xs">
          الكمية المدخلة *
        </Label>
        <Input id="quantityInput" name="quantityInput" type="number" min="0" step="0.001" className="w-28" />
        {state.errors?.quantityInput && <span className="text-xs text-destructive">{state.errors.quantityInput[0]}</span>}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="quantityOutput" className="text-xs">
          الكمية المخرجة
        </Label>
        <Input id="quantityOutput" name="quantityOutput" type="number" min="0" step="0.001" className="w-28" />
        {state.errors?.quantityOutput && <span className="text-xs text-destructive">{state.errors.quantityOutput[0]}</span>}
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "جاري الإضافة..." : "+ دفعة إنتاج"}
      </Button>
      {state.formError && <p role="alert" className="w-full text-sm text-destructive">{state.formError}</p>}
    </Form>
  );
}
