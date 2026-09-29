"use client";

import { useActionState } from "react";
import { createRejectionCase, type RejectionCaseFormState } from "../actions";
import { rejectionTypeLabel, rejectionSeverityLabel } from "@/lib/complianceLabels";
import { capaStatusLabel } from "@/lib/capaLabels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import CurrencySelect from "@/components/CurrencySelect";

const initialState: RejectionCaseFormState = {};
const rejectionTypes = Object.keys(rejectionTypeLabel);
const severities = Object.keys(rejectionSeverityLabel);

export default function RejectionCaseForm({
  complianceCaseId,
  capas,
  shipments,
}: {
  complianceCaseId: string;
  capas: { id: string; rootCause: string | null; status: string }[];
  shipments: { id: string; originPort: string; destinationPort: string }[];
}) {
  const action = createRejectionCase.bind(null, complianceCaseId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="rejectionType" className="text-xs">
          نوع الرفض
        </Label>
        <Select name="rejectionType" defaultValue={rejectionTypes[0]}>
          <SelectTrigger id="rejectionType" className="w-44">
            <SelectValue>{(value: string) => rejectionTypeLabel[value] ?? value}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {rejectionTypes.map((t) => (
              <SelectItem key={t} value={t}>
                {rejectionTypeLabel[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {capas.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="rc-capaId" className="text-xs">
            CAPA مرتبط
          </Label>
          <Select name="capaId">
            <SelectTrigger id="rc-capaId" className="w-40">
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
      {shipments.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="rc-shipmentId" className="text-xs">
            الشحنة
          </Label>
          <Select name="shipmentId">
            <SelectTrigger id="rc-shipmentId" className="w-40">
              <SelectValue placeholder="—">
                {(value: string) => {
                  const shipment = shipments.find((s) => s.id === value);
                  return shipment ? `${shipment.originPort} → ${shipment.destinationPort}` : value;
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {shipments.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.originPort} → {s.destinationPort}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="rc-authority" className="text-xs">
          الجهة *
        </Label>
        <Input id="rc-authority" name="authority" className="w-40" />
        {state.errors?.authority && <span className="text-xs text-destructive">{state.errors.authority[0]}</span>}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="severity" className="text-xs">
          الخطورة
        </Label>
        <Select name="severity" defaultValue={severities[0]}>
          <SelectTrigger id="severity" className="w-32">
            <SelectValue>{(value: string) => rejectionSeverityLabel[value] ?? value}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {severities.map((s) => (
              <SelectItem key={s} value={s}>
                {rejectionSeverityLabel[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="financialExposure" className="text-xs">
          التعرّض المالي
        </Label>
        <Input id="financialExposure" name="financialExposure" type="number" step="0.01" min="0" className="w-32" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="rc-currency" className="text-xs">
          العملة
        </Label>
        <CurrencySelect id="rc-currency" name="currency" className="w-20" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="finalResult" className="text-xs">
          النتيجة النهائية
        </Label>
        <Input id="finalResult" name="finalResult" className="w-48" />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "جاري الإضافة..." : "+ حالة رفض"}
      </Button>
      {state.formError && <p role="alert" className="w-full text-sm text-destructive">{state.formError}</p>}
    </form>
  );
}
