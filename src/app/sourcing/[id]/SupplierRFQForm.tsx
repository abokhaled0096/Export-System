"use client";

import { useActionState } from "react";
import { createSupplierRFQ, type SupplierRFQFormState } from "../actions";
import { supplierRFQStatusLabel } from "@/lib/procurementLabels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const initialState: SupplierRFQFormState = {};
const statuses = Object.keys(supplierRFQStatusLabel);

export default function SupplierRFQForm({ sourcingRequestId, suppliers }: { sourcingRequestId: string; suppliers: { id: string; legalName: string }[] }) {
  const action = createSupplierRFQ.bind(null, sourcingRequestId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="rfq-supplierId" className="text-xs">
          المورّد *
        </Label>
        <Select name="supplierId">
          <SelectTrigger id="rfq-supplierId" className="w-40">
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
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="rfqNumber" className="text-xs">
          رقم الطلب
        </Label>
        <Input id="rfqNumber" name="rfqNumber" className="w-32" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="responseDeadline" className="text-xs">
          آخر موعد للرد
        </Label>
        <Input id="responseDeadline" name="responseDeadline" type="date" className="w-40" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="rfq-status" className="text-xs">
          الحالة *
        </Label>
        <Select name="status" defaultValue={statuses[0]}>
          <SelectTrigger id="rfq-status" className="w-32">
            <SelectValue>{(value: string) => supplierRFQStatusLabel[value] ?? value}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {statuses.map((s) => (
              <SelectItem key={s} value={s}>
                {supplierRFQStatusLabel[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? "جاري الإضافة..." : "+ RFQ"}
      </Button>
      {state.formError && <p role="alert" className="w-full text-sm text-destructive">{state.formError}</p>}
    </form>
  );
}
