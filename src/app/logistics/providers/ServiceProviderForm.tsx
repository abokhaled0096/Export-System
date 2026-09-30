"use client";

import { useActionState } from "react";
import { createServiceProvider, type ServiceProviderFormState } from "./actions";
import { serviceProviderTypeLabel, serviceProviderStatusLabel } from "@/lib/logisticsLabels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form } from "@/components/ui/form";

const initialState: ServiceProviderFormState = {};
const types = Object.keys(serviceProviderTypeLabel);
const statuses = Object.keys(serviceProviderStatusLabel);

export default function ServiceProviderForm() {
  const [state, formAction, pending] = useActionState(createServiceProvider, initialState);

  return (
    <Form action={formAction} state={state} className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="providerType" className="text-xs">
          نوع المزوّد
        </Label>
        <Select name="providerType" defaultValue={types[0]}>
          <SelectTrigger id="providerType" className="w-44">
            <SelectValue>{(value: string) => serviceProviderTypeLabel[value] ?? value}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {types.map((t) => (
              <SelectItem key={t} value={t}>
                {serviceProviderTypeLabel[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="sp-name" className="text-xs">
          الاسم *
        </Label>
        <Input id="sp-name" name="name" className="w-40" />
        {state.errors?.name && <span className="text-xs text-destructive">{state.errors.name[0]}</span>}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="sp-country" className="text-xs">
          الدولة
        </Label>
        <Input id="sp-country" name="country" className="w-28" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="onTimePerformance" className="text-xs">
          الالتزام بالمواعيد %
        </Label>
        <Input id="onTimePerformance" name="onTimePerformance" type="number" min="0" max="100" className="w-24" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="invoiceAccuracy" className="text-xs">
          دقة الفواتير %
        </Label>
        <Input id="invoiceAccuracy" name="invoiceAccuracy" type="number" min="0" max="100" className="w-24" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="sp-status" className="text-xs">
          الحالة
        </Label>
        <Select name="status" defaultValue={statuses[3]}>
          <SelectTrigger id="sp-status" className="w-36">
            <SelectValue>{(value: string) => serviceProviderStatusLabel[value] ?? value}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {statuses.map((s) => (
              <SelectItem key={s} value={s}>
                {serviceProviderStatusLabel[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "جاري الإضافة..." : "+ مزوّد"}
      </Button>
      {state.formError && <p role="alert" className="w-full text-sm text-destructive">{state.formError}</p>}
    </Form>
  );
}
