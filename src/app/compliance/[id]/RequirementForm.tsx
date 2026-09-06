"use client";

import { useActionState } from "react";
import { createRequirement, type RequirementFormState } from "../actions";
import { requirementCategoryLabel } from "@/lib/complianceLabels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const initialState: RequirementFormState = {};
const categories = Object.keys(requirementCategoryLabel);

export default function RequirementForm({ complianceCaseId }: { complianceCaseId: string }) {
  const [state, formAction, pending] = useActionState(createRequirement, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
      <input type="hidden" name="complianceCaseId" value={complianceCaseId} />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="req-category" className="text-xs">
          الفئة
        </Label>
        <Select name="category" defaultValue={categories[0]}>
          <SelectTrigger id="req-category" className="w-40">
            <SelectValue>{(value: string) => requirementCategoryLabel[value] ?? value}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {categories.map((c) => (
              <SelectItem key={c} value={c}>
                {requirementCategoryLabel[c]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="req-name" className="text-xs">
          اسم المتطلب *
        </Label>
        <Input id="req-name" name="name" className="w-56" placeholder="شهادة صحة نباتية" />
        {state.errors?.name && <span className="text-xs text-destructive">{state.errors.name[0]}</span>}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="req-responsibleParty" className="text-xs">
          المسؤول
        </Label>
        <Input id="req-responsibleParty" name="responsibleParty" className="w-36" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="req-issuingAuthority" className="text-xs">
          جهة الإصدار
        </Label>
        <Input id="req-issuingAuthority" name="issuingAuthority" className="w-36" />
      </div>
      <div className="flex items-center gap-2 pb-2">
        <Checkbox id="req-mandatory" name="mandatory" defaultChecked />
        <Label htmlFor="req-mandatory" className="text-xs">
          إلزامي
        </Label>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "جاري الإضافة..." : "+ إضافة متطلب"}
      </Button>
      {state.formError && <p role="alert" className="w-full text-sm text-destructive">{state.formError}</p>}
    </form>
  );
}
