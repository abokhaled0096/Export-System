"use client";

import { useActionState } from "react";
import { createSourcingRequest, type SourcingRequestFormState } from "@/app/sourcing/actions";
import { productSpecificationStatusLabel } from "@/lib/specificationLabels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import CurrencySelect from "@/components/CurrencySelect";
import { Form } from "@/components/ui/form";

const initialState: SourcingRequestFormState = {};

export default function OpenSourcingRequestForm({
  dealId,
  currency,
  specifications,
}: {
  dealId: string;
  currency: string;
  specifications: { id: string; version: number; status: string }[];
}) {
  const action = createSourcingRequest.bind(null, dealId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <Form action={formAction} state={state} className="flex flex-wrap items-end gap-3">
      {specifications.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="sr-specificationId" className="text-xs">
            المواصفة
          </Label>
          <Select name="specificationId">
            <SelectTrigger id="sr-specificationId" className="w-40">
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
        <Label htmlFor="maximumPurchasePrice" className="text-xs">
          الحد الأقصى لسعر الشراء *
        </Label>
        <Input id="maximumPurchasePrice" name="maximumPurchasePrice" type="number" min="0" step="0.0001" className="w-32" />
        {state.errors?.maximumPurchasePrice && <span className="text-xs text-destructive">{state.errors.maximumPurchasePrice[0]}</span>}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="sr-currency" className="text-xs">
          العملة *
        </Label>
        <CurrencySelect id="sr-currency" name="currency" defaultValue={currency} className="w-20" />
        {state.errors?.currency && <span className="text-xs text-destructive">{state.errors.currency[0]}</span>}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="rawQuantityRequired" className="text-xs">
          الكمية الخام المطلوبة
        </Label>
        <Input id="rawQuantityRequired" name="rawQuantityRequired" type="number" min="0" step="0.001" className="w-28" />
      </div>
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? "جاري الفتح..." : "فتح طلب توريد"}
      </Button>
      {state.formError && <span role="alert" className="text-xs text-destructive">{state.formError}</span>}
    </Form>
  );
}
