"use client";

import { useActionState } from "react";
import { createRiskRegisterItem, type RiskFormState } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: RiskFormState = {};

export default function RiskForm() {
  const [state, formAction, pending] = useActionState(createRiskRegisterItem, initialState);

  return (
    <form action={formAction} className="grid gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="risk-title" className="text-xs">
          العنوان *
        </Label>
        <Input id="risk-title" name="title" />
        {state.errors?.title && <span className="text-xs text-destructive">{state.errors.title[0]}</span>}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="risk-category" className="text-xs">
          الفئة *
        </Label>
        <Input id="risk-category" name="category" placeholder="مالي / تشغيلي / امتثال" />
        {state.errors?.category && <span className="text-xs text-destructive">{state.errors.category[0]}</span>}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="risk-prob" className="text-xs">
          الاحتمالية (0-100) *
        </Label>
        <Input id="risk-prob" name="probability" type="number" min="0" max="100" />
        {state.errors?.probability && <span className="text-xs text-destructive">{state.errors.probability[0]}</span>}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="risk-impact" className="text-xs">
          الأثر المالي *
        </Label>
        <Input id="risk-impact" name="financialImpact" type="number" step="0.01" />
        {state.errors?.financialImpact && <span className="text-xs text-destructive">{state.errors.financialImpact[0]}</span>}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="risk-currency" className="text-xs">
          العملة *
        </Label>
        <Input id="risk-currency" name="currency" defaultValue="EGP" />
      </div>
      <div className="flex flex-col gap-1.5 sm:col-span-2 lg:col-span-3">
        <Label htmlFor="risk-mitigation" className="text-xs">
          خطة التخفيف
        </Label>
        <Input id="risk-mitigation" name="mitigation" />
      </div>
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "جاري التسجيل..." : "+ خطر"}
        </Button>
      </div>
      {state.formError && (
        <p role="alert" className="text-sm text-destructive sm:col-span-2 lg:col-span-3">
          {state.formError}
        </p>
      )}
    </form>
  );
}
