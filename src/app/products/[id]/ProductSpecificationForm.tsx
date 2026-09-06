"use client";

import { useActionState } from "react";
import { createProductSpecification, type ProductSpecificationFormState } from "../actions";
import { productSpecificationStatusLabel } from "@/lib/specificationLabels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const initialState: ProductSpecificationFormState = {};
const statuses = Object.keys(productSpecificationStatusLabel);

export default function ProductSpecificationForm({ productId }: { productId: string }) {
  const action = createProductSpecification.bind(null, productId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="version" className="text-xs">
          النسخة
        </Label>
        <Input id="version" name="version" type="number" min="1" step="1" defaultValue={1} className="w-20" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="spec-status" className="text-xs">
          الحالة *
        </Label>
        <Select name="status" defaultValue={statuses[0]}>
          <SelectTrigger id="spec-status" className="w-36">
            <SelectValue>{(value: string) => productSpecificationStatusLabel[value] ?? value}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {statuses.map((s) => (
              <SelectItem key={s} value={s}>
                {productSpecificationStatusLabel[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="storageConditions" className="text-xs">
          ظروف التخزين
        </Label>
        <Input id="storageConditions" name="storageConditions" className="w-40" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="spec-shelfLifeDays" className="text-xs">
          مدة الصلاحية (يوم)
        </Label>
        <Input id="spec-shelfLifeDays" name="shelfLifeDays" type="number" min="0" step="1" className="w-28" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="reviewDate" className="text-xs">
          تاريخ المراجعة
        </Label>
        <Input id="reviewDate" name="reviewDate" type="date" className="w-40" />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "جاري الإضافة..." : "+ مواصفة"}
      </Button>
      {state.formError && <p role="alert" className="w-full text-sm text-destructive">{state.formError}</p>}
    </form>
  );
}
