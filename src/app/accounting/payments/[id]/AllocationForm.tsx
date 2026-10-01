"use client";

import { useActionState } from "react";
import { createPaymentAllocation, type AllocationFormState } from "../../arap-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form } from "@/components/ui/form";

const initialState: AllocationFormState = {};

export type OpenInvoiceOption = { id: string; label: string };

export default function AllocationForm({
  paymentId,
  invoices,
  unallocated,
  allAlreadyAllocated = false,
}: {
  paymentId: string;
  invoices: OpenInvoiceOption[];
  unallocated: string;
  /** كل الفواتير المؤهّلة متخصَّص عليها من الدفعة دي بالفعل — سبب مختلف تمامًا عن "مفيش فواتير". */
  allAlreadyAllocated?: boolean;
}) {
  const action = createPaymentAllocation.bind(null, paymentId);
  const [state, formAction, pending] = useActionState(action, initialState);

  if (invoices.length === 0) {
    return (
      <p className="rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
        {/* الرسالتين كانوا رسالة واحدة بتقول «مفيش فواتير مفتوحة بنفس العملة» — وده كان
            بيبعت المستخدم يدوّر على مشكلة عملة مش موجودة أصلًا، والسبب الحقيقي إن الفاتورة
            متخصَّص عليها من نفس الدفعة قبل كده (صف تخصيص واحد لكل فاتورة/دفعة بالتصميم).
            اتكشف وأنا بحاول أخصّص الباقي على نفس الفاتورة، 1 أكتوبر. */}
        {allAlreadyAllocated
          ? "كل الفواتير المفتوحة المناسبة متخصَّص عليها من الدفعة دي بالفعل. عشان تغيّر مبلغ تخصيص قايم، ألغِ التخصيص من الجدول تحت وسجّله تاني بالمبلغ الصح."
          : "مفيش فواتير مفتوحة بنفس العملة تتخصّص عليها الدفعة دي."}
      </p>
    );
  }

  return (
    <Form action={formAction} state={state} className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
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
    </Form>
  );
}
