"use client";

import { useActionState } from "react";
import { createAccountingPeriod, type AccountingPeriodFormState } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: AccountingPeriodFormState = {};

export default function AccountingPeriodForm() {
  const [state, formAction, pending] = useActionState(createAccountingPeriod, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="periodName" className="text-xs">
          اسم الفترة *
        </Label>
        <Input id="periodName" name="periodName" placeholder="2026-09" className="w-28" />
        {state.errors?.periodName && <span className="text-xs text-destructive">{state.errors.periodName[0]}</span>}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="startDate" className="text-xs">
          تاريخ البداية *
        </Label>
        <Input id="startDate" name="startDate" type="date" className="w-40" />
        {state.errors?.startDate && <span className="text-xs text-destructive">{state.errors.startDate[0]}</span>}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="endDate" className="text-xs">
          تاريخ النهاية *
        </Label>
        <Input id="endDate" name="endDate" type="date" className="w-40" />
        {state.errors?.endDate && <span className="text-xs text-destructive">{state.errors.endDate[0]}</span>}
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "جاري الإضافة..." : "+ فترة"}
      </Button>
      {state.formError && <p role="alert" className="w-full text-sm text-destructive">{state.formError}</p>}
    </form>
  );
}
