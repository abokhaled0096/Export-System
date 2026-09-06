"use client";

import { useActionState } from "react";
import { createPaymentAllocation, type AllocationFormState } from "../../arap-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const initialState: AllocationFormState = {};

export type OpenInvoiceOption = { id: string; label: string };

export default function AllocationForm({
  paymentId,
  invoices,
  unallocated,
}: {
  paymentId: string;
  invoices: OpenInvoiceOption[];
  unallocated: string;
}) {
  const action = createPaymentAllocation.bind(null, paymentId);
  const [state, formAction, pending] = useActionState(action, initialState);

  if (invoices.length === 0) {
    return (
      <p className="rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
        مفيش فواتير مفتوحة بنفس العملة تتخصّص عليها الدفعة دي.
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="alloc-invoice" className="text-xs">
          الفاتورة *
        </Label>
        <Select name="invoiceId">
          <SelectTrigger id="alloc-invoice" className="w-72">
            <SelectValue>{(value: string) => invoices.find((i) => i.id === value)?.label ?? "— اختر فاتورة —"}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {invoices.map((i) => (
              <SelectItem key={i.id} value={i.id}>
                {i.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {state.errors?.invoiceId && <span className="text-xs text-destructive">{state.errors.invoiceId[0]}</span>}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="alloc-amount" className="text-xs">
          المبلغ *
        </Label>
        <Input id="alloc-amount" name="allocatedAmount" type="number" step="0.01" className="w-32" />
        {state.errors?.allocatedAmount && <span className="text-xs text-destructive">{state.errors.allocatedAmount[0]}</span>}
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "جاري التخصيص..." : "تخصيص"}
      </Button>
      <span className="text-xs text-muted-foreground">غير مخصَّص من الدفعة: {unallocated}</span>
      {state.formError && (
        <p role="alert" className="w-full text-sm text-destructive">
          {state.formError}
        </p>
      )}
    </form>
  );
}
