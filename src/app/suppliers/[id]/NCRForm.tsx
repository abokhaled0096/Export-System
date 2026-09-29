"use client";

import { useActionState } from "react";
import { createNCR, type NCRFormState } from "../actions";
import { ncrTypeLabel, ncrSeverityLabel } from "@/lib/procurementLabels";
import { capaStatusLabel } from "@/lib/capaLabels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import CurrencySelect from "@/components/CurrencySelect";

const initialState: NCRFormState = {};
const ncrTypes = Object.keys(ncrTypeLabel);
const severities = Object.keys(ncrSeverityLabel);

export default function NCRForm({
  supplierId,
  facilities,
  capas,
}: {
  supplierId: string;
  facilities: { id: string; name: string }[];
  capas: { id: string; rootCause: string | null; status: string }[];
}) {
  const action = createNCR.bind(null, supplierId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ncr-facilityId" className="text-xs">
          المنشأة *
        </Label>
        <Select name="facilityId">
          <SelectTrigger id="ncr-facilityId" className="w-40">
            <SelectValue placeholder="اختر منشأة">{(value: string) => facilities.find((f) => f.id === value)?.name ?? value}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {facilities.map((f) => (
              <SelectItem key={f.id} value={f.id}>
                {f.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {state.errors?.facilityId && <span className="text-xs text-destructive">{state.errors.facilityId[0]}</span>}
      </div>
      {capas.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ncr-capaId" className="text-xs">
            CAPA مرتبط
          </Label>
          <Select name="capaId">
            <SelectTrigger id="ncr-capaId" className="w-40">
              <SelectValue placeholder="—">
                {(value: string) => {
                  const capa = capas.find((c) => c.id === value);
                  return capa ? `${capa.rootCause ?? "—"} — ${capaStatusLabel[capa.status] ?? capa.status}` : value;
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {capas.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.rootCause ?? "—"} — {capaStatusLabel[c.status] ?? c.status}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ncrType" className="text-xs">
          نوع المخالفة *
        </Label>
        <Select name="ncrType" defaultValue={ncrTypes[0]}>
          <SelectTrigger id="ncrType" className="w-40">
            <SelectValue>{(value: string) => ncrTypeLabel[value] ?? value}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {ncrTypes.map((t) => (
              <SelectItem key={t} value={t}>
                {ncrTypeLabel[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="severity" className="text-xs">
          الخطورة *
        </Label>
        <Select name="severity" defaultValue={severities[0]}>
          <SelectTrigger id="severity" className="w-28">
            <SelectValue>{(value: string) => ncrSeverityLabel[value] ?? value}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {severities.map((s) => (
              <SelectItem key={s} value={s}>
                {ncrSeverityLabel[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="quantityAffected" className="text-xs">
          الكمية المتأثرة
        </Label>
        <Input id="quantityAffected" name="quantityAffected" type="number" min="0" step="0.001" className="w-24" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="financialExposure" className="text-xs">
          التعرّض المالي
        </Label>
        <Input id="financialExposure" name="financialExposure" type="number" min="0" step="0.01" className="w-28" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ncr-currency" className="text-xs">
          العملة
        </Label>
        <CurrencySelect id="ncr-currency" name="currency" className="w-20" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="immediateContainment" className="text-xs">
          إجراء الاحتواء الفوري
        </Label>
        <Input id="immediateContainment" name="immediateContainment" className="w-40" />
      </div>
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? "جاري التسجيل..." : "+ مخالفة"}
      </Button>
      {state.formError && <p role="alert" className="w-full text-sm text-destructive">{state.formError}</p>}
    </form>
  );
}
