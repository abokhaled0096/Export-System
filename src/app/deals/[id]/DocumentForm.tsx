"use client";

import { useActionState } from "react";
import { createDocument, type DocumentFormState } from "../actions";
import { documentTypeLabel, documentLanguageLabel, documentEtaStatusLabel } from "@/lib/documentLabels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form } from "@/components/ui/form";

const initialState: DocumentFormState = {};
const documentTypes = Object.keys(documentTypeLabel);
const languages = Object.keys(documentLanguageLabel);
const etaStatuses = Object.keys(documentEtaStatusLabel);

export default function DocumentForm({ dealId }: { dealId: string }) {
  const action = createDocument.bind(null, dealId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <Form action={formAction} state={state} className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="documentType" className="text-xs">
          نوع المستند *
        </Label>
        <Select name="documentType" defaultValue={documentTypes[0]}>
          <SelectTrigger id="documentType" className="w-36">
            <SelectValue>{(value: string) => documentTypeLabel[value] ?? value}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {documentTypes.map((t) => (
              <SelectItem key={t} value={t}>
                {documentTypeLabel[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="documentNumber" className="text-xs">
          رقم المستند *
        </Label>
        <Input id="documentNumber" name="documentNumber" className="w-32" />
        {state.errors?.documentNumber && <span className="text-xs text-destructive">{state.errors.documentNumber[0]}</span>}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="doc-file" className="text-xs">
          الملف
        </Label>
        <Input id="doc-file" name="file" type="file" className="w-40" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="doc-version" className="text-xs">
          النسخة
        </Label>
        <Input id="doc-version" name="version" type="number" min="1" step="1" defaultValue={1} className="w-20" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="language" className="text-xs">
          اللغة *
        </Label>
        <Select name="language" defaultValue={languages[0]}>
          <SelectTrigger id="language" className="w-28">
            <SelectValue>{(value: string) => documentLanguageLabel[value] ?? value}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {languages.map((l) => (
              <SelectItem key={l} value={l}>
                {documentLanguageLabel[l]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="confidentiality" className="text-xs">
          درجة السرّية
        </Label>
        <Select name="confidentiality">
          <SelectTrigger id="confidentiality" className="w-28">
            <SelectValue placeholder="—" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="عام">عام</SelectItem>
            <SelectItem value="سري">سري</SelectItem>
            <SelectItem value="سري للغاية">سري للغاية</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="doc-expiryDate" className="text-xs">
          تاريخ الانتهاء
        </Label>
        <Input id="doc-expiryDate" name="expiryDate" type="date" className="w-40" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="etaUuid" className="text-xs">
          UUID الفاتورة الإلكترونية (ETA)
        </Label>
        <Input id="etaUuid" name="etaUuid" className="w-40" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="etaStatus" className="text-xs">
          حالة ETA
        </Label>
        <Select name="etaStatus" defaultValue={etaStatuses[0]}>
          <SelectTrigger id="etaStatus" className="w-32">
            <SelectValue>{(value: string) => documentEtaStatusLabel[value] ?? value}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {etaStatuses.map((s) => (
              <SelectItem key={s} value={s}>
                {documentEtaStatusLabel[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="etaSubmittedAt" className="text-xs">
          تاريخ إرسال ETA
        </Label>
        <Input id="etaSubmittedAt" name="etaSubmittedAt" type="date" className="w-40" />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "جاري الإضافة..." : "+ مستند"}
      </Button>
      {state.formError && <p role="alert" className="w-full text-sm text-destructive">{state.formError}</p>}
    </Form>
  );
}
