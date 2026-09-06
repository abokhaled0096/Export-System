"use client";

import { useActionState } from "react";
import { createPurchaseOrder, type PurchaseOrderFormState } from "../actions";
import { productSpecificationStatusLabel } from "@/lib/specificationLabels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const initialState: PurchaseOrderFormState = {};

export default function PurchaseOrderForm({
  sourcingRequestId,
  suppliers,
  facilities,
  specifications,
  maximumPurchasePrice,
  currency,
}: {
  sourcingRequestId: string;
  suppliers: { id: string; legalName: string }[];
  facilities: { id: string; name: string; supplierId: string }[];
  specifications: { id: string; version: number; status: string }[];
  maximumPurchasePrice: string;
  currency: string;
}) {
  const action = createPurchaseOrder.bind(null, sourcingRequestId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="po-supplierId" className="text-xs">
          المورّد *
        </Label>
        <Select name="supplierId">
          <SelectTrigger id="po-supplierId" className="w-40">
            <SelectValue placeholder="اختر مورّد">{(value: string) => suppliers.find((s) => s.id === value)?.legalName ?? value}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {suppliers.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.legalName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {state.errors?.supplierId && <span className="text-xs text-destructive">{state.errors.supplierId[0]}</span>}
      </div>
      {facilities.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="po-facilityId" className="text-xs">
            المنشأة
          </Label>
          <Select name="facilityId">
            <SelectTrigger id="po-facilityId" className="w-36">
              <SelectValue placeholder="—">{(value: string) => facilities.find((f) => f.id === value)?.name ?? value}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {facilities.map((f) => (
                <SelectItem key={f.id} value={f.id}>
                  {f.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      {specifications.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="po-specificationId" className="text-xs">
            المواصفة
          </Label>
          <Select name="specificationId">
            <SelectTrigger id="po-specificationId" className="w-40">
              <SelectValue placeholder="—">
                {(value: string) => {
                  const spec = specifications.find((s) => s.id === value);
                  return spec ? `نسخة ${spec.version} — ${productSpecificationStatusLabel[spec.status] ?? spec.status}` : value;
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {specifications.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  نسخة {s.version} — {productSpecificationStatusLabel[s.status] ?? s.status}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="po-quantity" className="text-xs">
          الكمية *
        </Label>
        <Input id="po-quantity" name="quantity" type="number" min="0" step="0.001" className="w-28" />
        {state.errors?.quantity && <span className="text-xs text-destructive">{state.errors.quantity[0]}</span>}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="po-unitPrice" className="text-xs">
          سعر الوحدة * (الحد الأقصى: {maximumPurchasePrice} {currency})
        </Label>
        <Input id="po-unitPrice" name="unitPrice" type="number" min="0" step="0.0001" className="w-28" />
        {state.errors?.unitPrice && <span className="text-xs text-destructive">{state.errors.unitPrice[0]}</span>}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="po-currency" className="text-xs">
          العملة *
        </Label>
        <Input id="po-currency" name="currency" defaultValue={currency} className="w-20" />
        {state.errors?.currency && <span className="text-xs text-destructive">{state.errors.currency[0]}</span>}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="po-paymentTerms" className="text-xs">
          شروط الدفع
        </Label>
        <Input id="po-paymentTerms" name="paymentTerms" className="w-32" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="penalties" className="text-xs">
          الغرامات
        </Label>
        <Input id="penalties" name="penalties" className="w-32" />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "جاري الإنشاء..." : "+ أمر شراء"}
      </Button>
      {state.formError && <p role="alert" className="w-full text-sm text-destructive">{state.formError}</p>}
    </form>
  );
}
