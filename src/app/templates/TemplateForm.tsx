"use client";

import { useActionState } from "react";
import { createTemplate, type TemplateFormState } from "./actions";
import { documentTypeLabel, documentLanguageLabel } from "@/lib/documentLabels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form } from "@/components/ui/form";

const initialState: TemplateFormState = {};
const documentTypes = Object.keys(documentTypeLabel);
const languages = Object.keys(documentLanguageLabel);

export default function TemplateForm({
  markets,
  customers,
}: {
  markets: { id: string; countryNameAr: string }[];
  customers: { id: string; legalName: string }[];
}) {
  const [state, formAction, pending] = useActionState(createTemplate, initialState);

  return (
    <Form action={formAction} state={state} className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="documentType" className="text-xs">
          نوع المستند
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
        <Label htmlFor="tpl-language" className="text-xs">
          اللغة
        </Label>
        <Select name="language" defaultValue={languages[0]}>
          <SelectTrigger id="tpl-language" className="w-28">
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
      {markets.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="tpl-marketId" className="text-xs">
            السوق
          </Label>
          <Select name="marketId">
            <SelectTrigger id="tpl-marketId" className="w-32">
              <SelectValue placeholder="—">{(value: string) => markets.find((m) => m.id === value)?.countryNameAr ?? value}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {markets.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.countryNameAr}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      {customers.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="tpl-customerId" className="text-xs">
            العميل
          </Label>
          <Select name="customerId">
            <SelectTrigger id="tpl-customerId" className="w-36">
              <SelectValue placeholder="—">{(value: string) => customers.find((c) => c.id === value)?.legalName ?? value}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {customers.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.legalName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="tpl-version" className="text-xs">
          النسخة
        </Label>
        <Input id="tpl-version" name="version" type="number" min="1" step="1" defaultValue={1} className="w-20" />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "جاري الإضافة..." : "+ قالب"}
      </Button>
      {state.formError && <p role="alert" className="w-full text-sm text-destructive">{state.formError}</p>}
    </Form>
  );
}
