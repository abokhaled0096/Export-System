"use client";

import { useActionState } from "react";
import { createCustomerServiceCase, type CustomerServiceCaseFormState } from "../actions";
import { customerServiceCaseTypeLabel } from "@/lib/customerServiceCaseLabels";
import { capaStatusLabel } from "@/lib/capaLabels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import CurrencySelect from "@/components/CurrencySelect";

const initialState: CustomerServiceCaseFormState = {};
const caseTypes = Object.keys(customerServiceCaseTypeLabel);

export default function CustomerServiceCaseForm({
  companyId,
  capas,
}: {
  companyId: string;
  capas: { id: string; rootCause: string | null; status: string }[];
}) {
  const action = createCustomerServiceCase.bind(null, companyId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="caseType" className="text-xs">
          نوع الحالة
        </Label>
        <Select name="caseType" defaultValue={caseTypes[0]}>
          <SelectTrigger id="caseType" className="w-36">
            <SelectValue>{(value: string) => customerServiceCaseTypeLabel[value] ?? value}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {caseTypes.map((t) => (
              <SelectItem key={t} value={t}>
                {customerServiceCaseTypeLabel[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="slaDeadline" className="text-xs">
          الموعد النهائي (SLA)
        </Label>
        <Input id="slaDeadline" name="slaDeadline" type="date" className="w-40" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="rootCause" className="text-xs">
          السبب الجذري
        </Label>
        <Input id="rootCause" name="rootCause" className="w-40" />
      </div>
      {capas.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="csc-capaId" className="text-xs">
            CAPA مرتبط
          </Label>
          <Select name="capaId">
            <SelectTrigger id="csc-capaId" className="w-40">
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
        <Label htmlFor="compensationAmount" className="text-xs">
          التعويض
        </Label>
        <Input id="compensationAmount" name="compensationAmount" type="number" min="0" step="0.01" className="w-28" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="csc-currency" className="text-xs">
          العملة
        </Label>
        <CurrencySelect id="csc-currency" name="currency" className="w-20" />
      </div>
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? "جاري الإضافة..." : "+ حالة خدمة عملاء"}
      </Button>
      {state.formError && <p role="alert" className="w-full text-sm text-destructive">{state.formError}</p>}
    </form>
  );
}
