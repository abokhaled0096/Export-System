"use client";

import { useActionState } from "react";
import { createCustomerSample, type CustomerSampleFormState } from "./actions";
import { customerSampleStatusLabel } from "@/lib/customerSampleLabels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const initialState: CustomerSampleFormState = {};
const statuses = Object.keys(customerSampleStatusLabel);

export default function CustomerSampleForm({
  opportunityId,
  productId,
  productLabel,
  batches,
}: {
  opportunityId: string;
  productId: string;
  productLabel: string;
  batches: { id: string; batchCode: string }[];
}) {
  const action = createCustomerSample.bind(null, opportunityId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
      <input type="hidden" name="productId" value={productId} />
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs">المنتج</Label>
        <div className="flex h-9 w-40 items-center rounded-md border border-input bg-muted px-3 text-sm text-muted-foreground">{productLabel}</div>
      </div>
      {batches.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="batchId" className="text-xs">
            الدفعة
          </Label>
          <Select name="batchId">
            <SelectTrigger id="batchId" className="w-32">
              <SelectValue placeholder="—">{(value: string) => batches.find((b) => b.id === value)?.batchCode ?? value}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {batches.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.batchCode}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="cs-quantity" className="text-xs">
          الكمية
        </Label>
        <Input id="cs-quantity" name="quantity" type="number" min="0" step="0.001" className="w-24" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="totalCost" className="text-xs">
          التكلفة الإجمالية
        </Label>
        <Input id="totalCost" name="totalCost" type="number" min="0" step="0.01" className="w-28" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="cs-currency" className="text-xs">
          العملة
        </Label>
        <Input id="cs-currency" name="currency" placeholder="USD" className="w-20" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="trackingNumber" className="text-xs">
          رقم التتبّع
        </Label>
        <Input id="trackingNumber" name="trackingNumber" className="w-32" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="cs-status" className="text-xs">
          الحالة
        </Label>
        <Select name="status" defaultValue={statuses[0]}>
          <SelectTrigger id="cs-status" className="w-36">
            <SelectValue>{(value: string) => customerSampleStatusLabel[value] ?? value}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {statuses.map((s) => (
              <SelectItem key={s} value={s}>
                {customerSampleStatusLabel[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "جاري الإضافة..." : "+ عينة"}
      </Button>
      {state.formError && <p role="alert" className="w-full text-sm text-destructive">{state.formError}</p>}
    </form>
  );
}
