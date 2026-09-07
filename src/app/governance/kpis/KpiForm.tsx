"use client";

import { useActionState } from "react";
import { createKPI, type KpiFormState } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const initialState: KpiFormState = {};

export type PeriodOption = { id: string; label: string };

export default function KpiForm({ periods }: { periods: PeriodOption[] }) {
  const [state, formAction, pending] = useActionState(createKPI, initialState);

  if (periods.length === 0) {
    return (
      <p className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        لازم تضيف فترة محاسبية واحدة على الأقل قبل ما تسجّل مؤشر أداء.
      </p>
    );
  }

  return (
    <form action={formAction} className="grid gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="kpi-name" className="text-xs">
          الاسم *
        </Label>
        <Input id="kpi-name" name="name" />
        {state.errors?.name && <span className="text-xs text-destructive">{state.errors.name[0]}</span>}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="kpi-category" className="text-xs">
          الفئة *
        </Label>
        <Input id="kpi-category" name="category" placeholder="مبيعات / تشغيل / مالي" />
        {state.errors?.category && <span className="text-xs text-destructive">{state.errors.category[0]}</span>}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="kpi-period" className="text-xs">
          الفترة *
        </Label>
        <Select name="periodId" defaultValue={periods[0]?.id}>
          <SelectTrigger id="kpi-period">
            <SelectValue>{(value: string) => periods.find((p) => p.id === value)?.label ?? "—"}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {periods.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="kpi-target" className="text-xs">
          القيمة المستهدفة *
        </Label>
        <Input id="kpi-target" name="targetValue" type="number" step="0.01" />
        {state.errors?.targetValue && <span className="text-xs text-destructive">{state.errors.targetValue[0]}</span>}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="kpi-actual" className="text-xs">
          القيمة الفعلية
        </Label>
        <Input id="kpi-actual" name="actualValue" type="number" step="0.01" />
        <span className="text-[11px] text-muted-foreground">إدخال يدوي — مفيش محرك يحسبها تلقائيًا.</span>
      </div>
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "جاري التسجيل..." : "+ مؤشر"}
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
