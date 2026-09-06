"use client";

import { useActionState } from "react";
import { createSupplier, type SupplierFormState } from "./actions";
import { supplierTypeLabel, supplierStatusLabel } from "@/lib/procurementLabels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const initialState: SupplierFormState = {};
const statuses = Object.keys(supplierStatusLabel);
const types = Object.keys(supplierTypeLabel);

export default function SupplierForm() {
  const [state, formAction, pending] = useActionState(createSupplier, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="legalName" className="text-xs">
            الاسم القانوني *
          </Label>
          <Input id="legalName" name="legalName" className="w-40" />
          {state.errors?.legalName && <span className="text-xs text-destructive">{state.errors.legalName[0]}</span>}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="tradeName" className="text-xs">
            الاسم التجاري
          </Label>
          <Input id="tradeName" name="tradeName" className="w-32" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="s-country" className="text-xs">
            الدولة
          </Label>
          <Input id="s-country" name="country" className="w-28" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="governorate" className="text-xs">
            المحافظة
          </Label>
          <Input id="governorate" name="governorate" className="w-28" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="s-city" className="text-xs">
            المدينة
          </Label>
          <Input id="s-city" name="city" className="w-28" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="taxId" className="text-xs">
            الرقم الضريبي
          </Label>
          <Input id="taxId" name="taxId" className="w-32" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="commercialRegNo" className="text-xs">
            السجل التجاري
          </Label>
          <Input id="commercialRegNo" name="commercialRegNo" className="w-32" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="s-status" className="text-xs">
            الحالة
          </Label>
          <Select name="status" defaultValue={statuses[0]}>
            <SelectTrigger id="s-status" className="w-36">
              <SelectValue>{(value: string) => supplierStatusLabel[value] ?? value}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {statuses.map((s) => (
                <SelectItem key={s} value={s}>
                  {supplierStatusLabel[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? "جاري الإضافة..." : "+ مورّد"}
        </Button>
      </div>
      <div>
        <p className="text-xs text-muted-foreground">نوع المورّد</p>
        <div className="mt-2 flex flex-wrap gap-3">
          {types.map((t) => (
            <div key={t} className="flex items-center gap-1.5">
              <Checkbox id={`stype-${t}`} name="supplierType" value={t} />
              <Label htmlFor={`stype-${t}`} className="text-xs font-normal">
                {supplierTypeLabel[t]}
              </Label>
            </div>
          ))}
        </div>
      </div>
      {state.formError && <p role="alert" className="text-sm text-destructive">{state.formError}</p>}
    </form>
  );
}
