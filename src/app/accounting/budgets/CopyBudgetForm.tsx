"use client";

import { useState, useTransition } from "react";
import { copyBudgetFromPeriodAction } from "../finance-actions";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { PeriodOption } from "./BudgetForm";

export default function CopyBudgetForm({ periods }: { periods: PeriodOption[] }) {
  const [fromPeriodId, setFromPeriodId] = useState("");
  const [toPeriodId, setToPeriodId] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ copiedCount: number; skippedCount: number } | null>(null);

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-xl border border-dashed border-border p-4">
      <div className="flex flex-col gap-1.5">
        <label className="text-xs text-muted-foreground">انسخ من فترة</label>
        <Select value={fromPeriodId} onValueChange={(v) => setFromPeriodId(v ?? "")}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="اختر فترة">{(value: string) => periods.find((p) => p.id === value)?.label ?? value}</SelectValue>
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
        <label className="text-xs text-muted-foreground">لفترة</label>
        <Select value={toPeriodId} onValueChange={(v) => setToPeriodId(v ?? "")}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="اختر فترة">{(value: string) => periods.find((p) => p.id === value)?.label ?? value}</SelectValue>
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
      <Button
        variant="outline"
        disabled={pending || !fromPeriodId || !toPeriodId}
        onClick={() => {
          setError(null);
          setResult(null);
          startTransition(async () => {
            const r = await copyBudgetFromPeriodAction(fromPeriodId, toPeriodId);
            if (r.formError) setError(r.formError);
            else setResult(r);
          });
        }}
      >
        {pending ? "جاري النسخ..." : "انسخ بنود الموازنة"}
      </Button>
      {result && (
        <span className="text-sm text-emerald-700">
          اتنسخ {result.copiedCount} بند{result.skippedCount > 0 ? ` (${result.skippedCount} اتخطّى — موجود بالفعل في الفترة الهدف)` : ""}.
        </span>
      )}
      {error && <p className="w-full text-sm text-destructive">{error}</p>}
    </div>
  );
}
