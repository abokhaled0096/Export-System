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

type Option = { id: string; label: string };

export default function RequirementSearchForm({
  products,
  markets,
  defaultProductId,
  defaultMarketId,
}: {
  products: Option[];
  markets: Option[];
  defaultProductId?: string;
  defaultMarketId?: string;
}) {
  const [state, formAction, pending] = useActionState(createRequirement, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="rs-productId" className="text-xs">
          المنتج *
        </Label>
        <Select name="productId" defaultValue={defaultProductId}>
          <SelectTrigger id="rs-productId" className="w-44">
            <SelectValue placeholder="اختر منتج">
              {(value: string | null) => (value ? products.find((p) => p.id === value)?.label ?? value : "اختر منتج")}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {products.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="rs-marketId" className="text-xs">
          السوق *
        </Label>
        <Select name="marketId" defaultValue={defaultMarketId}>
          <SelectTrigger id="rs-marketId" className="w-44">
            <SelectValue placeholder="اختر سوق">
              {(value: string | null) => (value ? markets.find((m) => m.id === value)?.label ?? value : "اختر سوق")}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {markets.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="rs-category" className="text-xs">
          الفئة
        </Label>
        <Select name="category" defaultValue={categories[0]}>
          <SelectTrigger id="rs-category" className="w-36">
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
        <Label htmlFor="rs-name" className="text-xs">
          اسم المتطلب *
        </Label>
        <Input id="rs-name" name="name" className="w-56" placeholder="شهادة صحة نباتية" />
        {state.errors?.name && <span className="text-xs text-destructive">{state.errors.name[0]}</span>}
      </div>
      <div className="flex items-center gap-2 pb-2">
        <Checkbox id="rs-mandatory" name="mandatory" defaultChecked />
        <Label htmlFor="rs-mandatory" className="text-xs">
          إلزامي
        </Label>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "جاري الإضافة..." : "+ تسجيل متطلب"}
      </Button>
      {state.errors?.complianceCaseId && (
        <span className="w-full text-xs text-destructive">{state.errors.complianceCaseId[0]}</span>
      )}
      {state.formError && <p role="alert" className="w-full text-sm text-destructive">{state.formError}</p>}
    </form>
  );
}
