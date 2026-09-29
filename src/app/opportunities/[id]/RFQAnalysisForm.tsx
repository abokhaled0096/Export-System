"use client";

import { useActionState } from "react";
import { createRFQAnalysis, type RFQAnalysisFormState } from "./actions";
import { rfqSeriousnessLevelLabel } from "@/lib/rfqAnalysisLabels";
import { paymentMethodLabel } from "@/lib/arapLabels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDate } from "@/lib/format";

const initialState: RFQAnalysisFormState = {};
const levels = Object.keys(rfqSeriousnessLevelLabel);

export default function RFQAnalysisForm({
  opportunityId,
  communications,
}: {
  opportunityId: string;
  communications: { id: string; subject: string | null; occurredAt: Date }[];
}) {
  const action = createRFQAnalysis.bind(null, opportunityId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
      {communications.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="communicationId" className="text-xs">
            التواصل المرتبط
          </Label>
          <Select name="communicationId">
            <SelectTrigger id="communicationId" className="w-40">
              <SelectValue placeholder="—">
                {(value: string) => {
                  const c = communications.find((c) => c.id === value);
                  return c ? c.subject ?? formatDate(c.occurredAt) : value;
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {communications.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.subject ?? formatDate(c.occurredAt)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="destinationPort" className="text-xs">
          ميناء الوصول
        </Label>
        <Input id="destinationPort" name="destinationPort" className="w-32" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="paymentMethod" className="text-xs">
          طريقة الدفع
        </Label>
        <Select name="paymentMethod">
          <SelectTrigger id="paymentMethod" className="w-32">
            <SelectValue placeholder="—">{(value: string) => paymentMethodLabel[value] ?? value}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {Object.keys(paymentMethodLabel).map((m) => (
              <SelectItem key={m} value={m}>
                {paymentMethodLabel[m]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="rfq-quantity" className="text-xs">
          الكمية
        </Label>
        <Input id="rfq-quantity" name="quantity" type="number" min="0" step="0.001" className="w-28" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="rfq-incoterm" className="text-xs">
          Incoterm
        </Label>
        <Input id="rfq-incoterm" name="incoterm" placeholder="FOB" className="w-24" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="seriousnessLevel" className="text-xs">
          مستوى الجدّية
        </Label>
        <Select name="seriousnessLevel">
          <SelectTrigger id="seriousnessLevel" className="w-40">
            <SelectValue placeholder="—">{(value: string) => rfqSeriousnessLevelLabel[value] ?? value}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {levels.map((l) => (
              <SelectItem key={l} value={l}>
                {rfqSeriousnessLevelLabel[l]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "جاري الإضافة..." : "+ تحليل RFQ"}
      </Button>
      {state.formError && <p role="alert" className="w-full text-sm text-destructive">{state.formError}</p>}
    </form>
  );
}
