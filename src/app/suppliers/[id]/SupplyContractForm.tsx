"use client";

import { useActionState } from "react";
import { createSupplyContract, type SupplyContractFormState } from "../actions";
import { supplyContractTypeLabel } from "@/lib/procurementLabels";
import { documentTypeLabel } from "@/lib/documentLabels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form } from "@/components/ui/form";

const initialState: SupplyContractFormState = {};
const contractTypes = Object.keys(supplyContractTypeLabel);

export default function SupplyContractForm({
  supplierId,
  documents,
}: {
  supplierId: string;
  documents: { id: string; documentNumber: string; documentType: string }[];
}) {
  const action = createSupplyContract.bind(null, supplierId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <Form action={formAction} state={state} className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="contractType" className="text-xs">
          نوع العقد *
        </Label>
        <Select name="contractType" defaultValue={contractTypes[0]}>
          <SelectTrigger id="contractType" className="w-36">
            <SelectValue>{(value: string) => supplyContractTypeLabel[value] ?? value}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {contractTypes.map((t) => (
              <SelectItem key={t} value={t}>
                {supplyContractTypeLabel[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {documents.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="sc-documentId" className="text-xs">
            مستند مرتبط
          </Label>
          <Select name="documentId">
            <SelectTrigger id="sc-documentId" className="w-40">
              <SelectValue placeholder="—">
                {(value: string) => {
                  const doc = documents.find((d) => d.id === value);
                  return doc ? `${doc.documentNumber} — ${documentTypeLabel[doc.documentType] ?? doc.documentType}` : value;
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {documents.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.documentNumber} — {documentTypeLabel[d.documentType] ?? d.documentType}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="startDate" className="text-xs">
          تاريخ البداية
        </Label>
        <Input id="startDate" name="startDate" type="date" className="w-40" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="endDate" className="text-xs">
          تاريخ النهاية
        </Label>
        <Input id="endDate" name="endDate" type="date" className="w-40" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="priceAdjustmentMechanism" className="text-xs">
          آلية تعديل السعر
        </Label>
        <Input id="priceAdjustmentMechanism" name="priceAdjustmentMechanism" className="w-40" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="forceMajeureClause" className="text-xs">
          بند القوة القاهرة
        </Label>
        <Input id="forceMajeureClause" name="forceMajeureClause" className="w-40" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="penaltyTerms" className="text-xs">
          شروط الجزاءات
        </Label>
        <Input id="penaltyTerms" name="penaltyTerms" className="w-40" />
      </div>
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? "جاري الإضافة..." : "+ عقد توريد"}
      </Button>
      {state.formError && <p role="alert" className="w-full text-sm text-destructive">{state.formError}</p>}
    </Form>
  );
}
