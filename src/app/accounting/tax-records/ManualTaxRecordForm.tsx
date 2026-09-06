"use client";

import { useActionState } from "react";
import { createTaxRecord, type TaxRecordFormState } from "../finance-actions";
import { taxTypeLabel } from "@/lib/treasuryLabels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const initialState: TaxRecordFormState = {};
const MANUAL_TYPES = ["WithholdingTax", "PayrollTax"] as const;

export type PeriodOption = { id: string; label: string };

export default function ManualTaxRecordForm({ periods }: { periods: PeriodOption[] }) {
  const [state, formAction, pending] = useActionState(createTaxRecord, initialState);

  if (periods.length === 0) return null;

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="tx-type" className="text-xs">
          النوع *
        </Label>
        <Select name="taxType" defaultValue={MANUAL_TYPES[0]}>
          <SelectTrigger id="tx-type" className="w-44">
            <SelectValue>{(value: string) => taxTypeLabel[value] ?? value}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {MANUAL_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {taxTypeLabel[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="tx-period" className="text-xs">
          الفترة *
        </Label>
        <Select name="periodId" defaultValue={periods[0]?.id}>
          <SelectTrigger id="tx-period" className="w-32">
            <SelectValue>{(value: string) => periods.find((p) => p.id === value)?.label ?? "—"}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {periods.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="tx-amount" className="text-xs">
          المبلغ *
        </Label>
        <Input id="tx-amount" name="amount" type="number" step="0.01" className="w-32" />
        {state.errors?.amount && <span className="text-xs text-destructive">{state.errors.amount[0]}</span>}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="tx-currency" className="text-xs">
          العملة *
        </Label>
        <Input id="tx-currency" name="currency" defaultValue="EGP" className="w-20" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="tx-eta" className="text-xs">
          مرجع ETA
        </Label>
        <Input id="tx-eta" name="etaReference" className="w-36" />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "جاري التسجيل..." : "+ إقرار يدوي"}
      </Button>
      <p className="w-full text-xs text-muted-foreground">
        خصم المنبع والمرتبات بيتسجّلوا يدويًا لحد ما يتضاف لهم حساب مخصص في شجرة الحسابات.
      </p>
      {state.formError && (
        <p role="alert" className="w-full text-sm text-destructive">
          {state.formError}
        </p>
      )}
    </form>
  );
}
