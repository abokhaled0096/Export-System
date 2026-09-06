"use client";

import { useActionState } from "react";
import { createDocumentPackage, type DocumentPackageFormState } from "../actions";
import { documentPackageTypeLabel, documentPackageStatusLabel } from "@/lib/documentPackageLabels";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const initialState: DocumentPackageFormState = {};
const packageTypes = Object.keys(documentPackageTypeLabel);
const statuses = Object.keys(documentPackageStatusLabel);

export default function DocumentPackageForm({ dealId }: { dealId: string }) {
  const action = createDocumentPackage.bind(null, dealId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="packageType" className="text-xs">
          نوع الحزمة
        </Label>
        <Select name="packageType" defaultValue={packageTypes[0]}>
          <SelectTrigger id="packageType" className="w-40">
            <SelectValue>{(value: string) => documentPackageTypeLabel[value] ?? value}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {packageTypes.map((t) => (
              <SelectItem key={t} value={t}>
                {documentPackageTypeLabel[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="dp-status" className="text-xs">
          الحالة
        </Label>
        <Select name="status" defaultValue={statuses[0]}>
          <SelectTrigger id="dp-status" className="w-36">
            <SelectValue>{(value: string) => documentPackageStatusLabel[value] ?? value}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {statuses.map((s) => (
              <SelectItem key={s} value={s}>
                {documentPackageStatusLabel[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? "جاري الإضافة..." : "+ حزمة مستندات"}
      </Button>
      {state.formError && <p role="alert" className="w-full text-sm text-destructive">{state.formError}</p>}
    </form>
  );
}
