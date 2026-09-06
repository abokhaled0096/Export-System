"use client";

import { useActionState } from "react";
import { createFreightQuote, type FreightQuoteFormState } from "./actions";
import { containerTypeLabel, freightQuoteStatusLabel } from "@/lib/logisticsLabels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const initialState: FreightQuoteFormState = {};
const statuses = Object.keys(freightQuoteStatusLabel);
const containerTypes = Object.keys(containerTypeLabel);

export default function FreightQuoteForm({
  routes,
  providers,
}: {
  routes: { id: string; originPort: string; destinationPort: string }[];
  providers: { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState(createFreightQuote, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="routeId" className="text-xs">
          خط الشحن *
        </Label>
        <Select name="routeId">
          <SelectTrigger id="routeId" className="w-48">
            <SelectValue placeholder="اختر خط">
              {(value: string) => {
                const r = routes.find((x) => x.id === value);
                return r ? `${r.originPort} ← ${r.destinationPort}` : value;
              }}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {routes.map((r) => (
              <SelectItem key={r.id} value={r.id}>
                {r.originPort} ← {r.destinationPort}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {state.errors?.routeId && <span className="text-xs text-destructive">{state.errors.routeId[0]}</span>}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="providerId" className="text-xs">
          مزوّد الخدمة *
        </Label>
        <Select name="providerId">
          <SelectTrigger id="providerId" className="w-40">
            <SelectValue placeholder="اختر مزوّد">{(value: string) => providers.find((p) => p.id === value)?.name ?? value}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {providers.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {state.errors?.providerId && <span className="text-xs text-destructive">{state.errors.providerId[0]}</span>}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="containerType" className="text-xs">
          نوع الحاوية
        </Label>
        <Select name="containerType">
          <SelectTrigger id="containerType" className="w-32">
            <SelectValue placeholder="—">{(value: string) => containerTypeLabel[value] ?? value}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {containerTypes.map((t) => (
              <SelectItem key={t} value={t}>
                {containerTypeLabel[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="originCharges" className="text-xs">
          مصاريف المنشأ
        </Label>
        <Input id="originCharges" name="originCharges" type="number" min="0" step="0.01" className="w-24" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="mainFreight" className="text-xs">
          أجرة الشحن الأساسية
        </Label>
        <Input id="mainFreight" name="mainFreight" type="number" min="0" step="0.01" className="w-28" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="destinationCharges" className="text-xs">
          مصاريف الوصول
        </Label>
        <Input id="destinationCharges" name="destinationCharges" type="number" min="0" step="0.01" className="w-24" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="insurance" className="text-xs">
          التأمين
        </Label>
        <Input id="insurance" name="insurance" type="number" min="0" step="0.01" className="w-20" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="fq-currency" className="text-xs">
          العملة
        </Label>
        <Input id="fq-currency" name="currency" className="w-20" placeholder="USD" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="transitDays" className="text-xs">
          مدة الشحن (أيام)
        </Label>
        <Input id="transitDays" name="transitDays" type="number" min="0" className="w-20" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="fq-freeTimeDays" className="text-xs">
          أيام السماح
        </Label>
        <Input id="fq-freeTimeDays" name="freeTimeDays" type="number" min="0" className="w-20" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="validFrom" className="text-xs">
          صالح من
        </Label>
        <Input id="validFrom" name="validFrom" type="date" className="w-40" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="validUntil" className="text-xs">
          صالح حتى
        </Label>
        <Input id="validUntil" name="validUntil" type="date" className="w-40" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="fq-status" className="text-xs">
          الحالة
        </Label>
        <Select name="status" defaultValue={statuses[0]}>
          <SelectTrigger id="fq-status" className="w-28">
            <SelectValue>{(value: string) => freightQuoteStatusLabel[value] ?? value}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {statuses.map((s) => (
              <SelectItem key={s} value={s}>
                {freightQuoteStatusLabel[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "جاري الإنشاء..." : "+ عرض سعر"}
      </Button>
      {state.formError && <p role="alert" className="w-full text-sm text-destructive">{state.formError}</p>}
    </form>
  );
}
