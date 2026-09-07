"use client";

import { useActionState } from "react";
import { createSupplierSample, type SupplierSampleFormState } from "../actions";
import { supplierSamplePurposeLabel, supplierSampleResultLabel } from "@/lib/procurementLabels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const initialState: SupplierSampleFormState = {};
const purposes = Object.keys(supplierSamplePurposeLabel);
const results = Object.keys(supplierSampleResultLabel);

export default function SupplierSampleForm({ supplierId, products }: { supplierId: string; products: { id: string; nameAr: string }[] }) {
  const action = createSupplierSample.bind(null, supplierId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="sample-productId" className="text-xs">
          المنتج *
        </Label>
        <Select name="productId">
          <SelectTrigger id="sample-productId" className="w-36">
            <SelectValue placeholder="اختر منتج">{(value: string) => products.find((p) => p.id === value)?.nameAr ?? value}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {products.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.nameAr}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {state.errors?.productId && <span className="text-xs text-destructive">{state.errors.productId[0]}</span>}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="purpose" className="text-xs">
          الغرض *
        </Label>
        <Select name="purpose" defaultValue={purposes[0]}>
          <SelectTrigger id="purpose" className="w-32">
            <SelectValue>{(value: string) => supplierSamplePurposeLabel[value] ?? value}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {purposes.map((p) => (
              <SelectItem key={p} value={p}>
                {supplierSamplePurposeLabel[p]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="sample-quantity" className="text-xs">
          الكمية
        </Label>
        <Input id="sample-quantity" name="quantity" type="number" min="0" step="0.001" className="w-24" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="cost" className="text-xs">
          التكلفة
        </Label>
        <Input id="cost" name="cost" type="number" min="0" step="0.01" className="w-24" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="sample-currency" className="text-xs">
          العملة
        </Label>
        <Input id="sample-currency" name="currency" className="w-20" placeholder="USD" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="result" className="text-xs">
          النتيجة *
        </Label>
        <Select name="result" defaultValue={results[0]}>
          <SelectTrigger id="result" className="w-32">
            <SelectValue>{(value: string) => supplierSampleResultLabel[value] ?? value}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {results.map((r) => (
              <SelectItem key={r} value={r}>
                {supplierSampleResultLabel[r]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? "جاري التسجيل..." : "+ عينة"}
      </Button>
      {state.formError && <p role="alert" className="w-full text-sm text-destructive">{state.formError}</p>}
    </form>
  );
}
