"use client";

import { useActionState } from "react";
import { createSupplierQuote, type SupplierQuoteFormState } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import CurrencySelect from "@/components/CurrencySelect";
import { Form } from "@/components/ui/form";

const initialState: SupplierQuoteFormState = {};

export default function SupplierQuoteForm({
  sourcingRequestId,
  suppliers,
}: {
  sourcingRequestId: string;
  suppliers: { id: string; legalName: string }[];
}) {
  const action = createSupplierQuote.bind(null, sourcingRequestId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <Form action={formAction} state={state} className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="sq-supplierId" className="text-xs">
          المورّد *
        </Label>
        <Select name="supplierId">
          <SelectTrigger id="sq-supplierId" className="w-40">
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
        <Label htmlFor="sq-unitPrice" className="text-xs">
          سعر الوحدة *
        </Label>
        <Input id="sq-unitPrice" name="unitPrice" type="number" min="0" step="0.0001" className="w-28" />
        {state.errors?.unitPrice && <span className="text-xs text-destructive">{state.errors.unitPrice[0]}</span>}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="priceUnit" className="text-xs">
          وحدة السعر
        </Label>
        <Input id="priceUnit" name="priceUnit" className="w-20" placeholder="kg" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="sq-currency" className="text-xs">
          العملة *
        </Label>
        <CurrencySelect id="sq-currency" name="currency" className="w-20" />
        {state.errors?.currency && <span className="text-xs text-destructive">{state.errors.currency[0]}</span>}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="leadTimeDays" className="text-xs">
          مدة التوريد (أيام)
        </Label>
        <Input id="leadTimeDays" name="leadTimeDays" type="number" min="0" className="w-24" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="availableQuantity" className="text-xs">
          الكمية المتاحة
        </Label>
        <Input id="availableQuantity" name="availableQuantity" type="number" min="0" step="0.001" className="w-28" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="minimumOrder" className="text-xs">
          الحد الأدنى للطلب
        </Label>
        <Input id="minimumOrder" name="minimumOrder" type="number" min="0" step="0.001" className="w-28" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="expectedYield" className="text-xs">
          نسبة الاستخلاص المتوقعة
        </Label>
        <Input id="expectedYield" name="expectedYield" type="number" min="0" max="1" step="0.01" className="w-24" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="totalEffectiveCost" className="text-xs">
          إجمالي التكلفة الفعلية
        </Label>
        <Input id="totalEffectiveCost" name="totalEffectiveCost" type="number" min="0" step="0.01" className="w-28" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="paymentTerms" className="text-xs">
          شروط الدفع
        </Label>
        <Input id="paymentTerms" name="paymentTerms" className="w-32" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="validUntil" className="text-xs">
          صالح حتى
        </Label>
        <Input id="validUntil" name="validUntil" type="date" className="w-40" />
      </div>
      <div className="flex items-center gap-1.5">
        <Checkbox id="packagingIncluded" name="packagingIncluded" />
        <Label htmlFor="packagingIncluded" className="text-xs font-normal">
          يشمل التعبئة
        </Label>
      </div>
      <div className="flex items-center gap-1.5">
        <Checkbox id="transportIncluded" name="transportIncluded" />
        <Label htmlFor="transportIncluded" className="text-xs font-normal">
          يشمل النقل
        </Label>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "جاري الإضافة..." : "+ عرض مورّد"}
      </Button>
      {state.formError && <p role="alert" className="w-full text-sm text-destructive">{state.formError}</p>}
    </Form>
  );
}
