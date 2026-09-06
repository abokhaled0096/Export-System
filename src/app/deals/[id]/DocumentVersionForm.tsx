"use client";

import { useActionState } from "react";
import { createDocumentVersion, type DocumentVersionFormState } from "../actions";
import { documentTypeLabel } from "@/lib/documentLabels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const initialState: DocumentVersionFormState = {};

export default function DocumentVersionForm({
  dealId,
  documents,
}: {
  dealId: string;
  documents: { id: string; documentNumber: string; documentType: string }[];
}) {
  const action = createDocumentVersion.bind(null, dealId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="dv-documentId" className="text-xs">
          المستند *
        </Label>
        <Select name="documentId" defaultValue={documents[0]?.id}>
          <SelectTrigger id="dv-documentId" className="w-44">
            <SelectValue>
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
        {state.errors?.documentId && <span className="text-xs text-destructive">{state.errors.documentId[0]}</span>}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="versionNumber" className="text-xs">
          رقم الإصدار *
        </Label>
        <Input id="versionNumber" name="versionNumber" type="number" min="1" step="1" defaultValue={1} className="w-24" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="changeReason" className="text-xs">
          سبب التعديل
        </Label>
        <Input id="changeReason" name="changeReason" className="w-56" />
      </div>
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? "جاري التسجيل..." : "+ إصدار"}
      </Button>
      {state.formError && <p role="alert" className="w-full text-sm text-destructive">{state.formError}</p>}
    </form>
  );
}
