"use client";

import { useActionState } from "react";
import { createClause, type ClauseFormState } from "./actions";
import { clauseCategoryLabel, clauseRiskLevelLabel } from "@/lib/clauseLabels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form } from "@/components/ui/form";

const initialState: ClauseFormState = {};
const categories = Object.keys(clauseCategoryLabel);
const riskLevels = Object.keys(clauseRiskLevelLabel);

export default function ClauseForm() {
  const [state, formAction, pending] = useActionState(createClause, initialState);

  return (
    <Form action={formAction} state={state} className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="title" className="text-xs">
          العنوان *
        </Label>
        <Input id="title" name="title" className="w-40" />
        {state.errors?.title && <span className="text-xs text-destructive">{state.errors.title[0]}</span>}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="category" className="text-xs">
          الفئة
        </Label>
        <Select name="category" defaultValue={categories[0]}>
          <SelectTrigger id="category" className="w-36">
            <SelectValue>{(value: string) => clauseCategoryLabel[value] ?? value}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {categories.map((c) => (
              <SelectItem key={c} value={c}>
                {clauseCategoryLabel[c]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="textAr" className="text-xs">
          النص (عربي)
        </Label>
        <Input id="textAr" name="textAr" className="w-56" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="textEn" className="text-xs">
          النص (إنجليزي)
        </Label>
        <Input id="textEn" name="textEn" className="w-56" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="riskLevel" className="text-xs">
          درجة الخطورة
        </Label>
        <Select name="riskLevel" defaultValue={riskLevels[0]}>
          <SelectTrigger id="riskLevel" className="w-28">
            <SelectValue>{(value: string) => clauseRiskLevelLabel[value] ?? value}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {riskLevels.map((r) => (
              <SelectItem key={r} value={r}>
                {clauseRiskLevelLabel[r]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center gap-1.5">
        <Checkbox id="approvalRequired" name="approvalRequired" />
        <Label htmlFor="approvalRequired" className="text-xs font-normal">
          يحتاج موافقة
        </Label>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "جاري الإضافة..." : "+ بند"}
      </Button>
      {state.formError && <p role="alert" className="w-full text-sm text-destructive">{state.formError}</p>}
    </Form>
  );
}
