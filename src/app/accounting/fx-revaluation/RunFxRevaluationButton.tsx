"use client";

import { useState, useTransition } from "react";
import { runFxRevaluationAction } from "../finance-actions";
import { Button } from "@/components/ui/button";

export default function RunFxRevaluationButton({ periodId }: { periodId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ revaluedInvoiceCount: number; revaluedCashAccountCount: number; skippedNoRateCount: number } | null>(null);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        disabled={pending}
        onClick={() => {
          setError(null);
          setResult(null);
          startTransition(async () => {
            try {
              const r = await runFxRevaluationAction(periodId);
              setResult(r);
            } catch (e) {
              setError(e instanceof Error ? e.message : "حصل خطأ.");
            }
          });
        }}
      >
        {pending ? "جاري التشغيل..." : "تشغيل إعادة تقييم فروق العملة"}
      </Button>
      {result && (
        <span className="text-sm text-emerald-700">
          {result.revaluedInvoiceCount > 0 || result.revaluedCashAccountCount > 0
            ? `اترحّل تعديل ${result.revaluedInvoiceCount} فاتورة${result.revaluedCashAccountCount > 0 ? ` و${result.revaluedCashAccountCount} حساب نقدية` : ""}${result.skippedNoRateCount > 0 ? ` (${result.skippedNoRateCount} اتخطّوا — مفيش سعر صرف حديث مسجّل لعملتهم)` : ""}.`
            : `مفيش فواتير ولا أرصدة نقدية محتاجة إعادة تقييم${result.skippedNoRateCount > 0 ? ` (${result.skippedNoRateCount} اتخطّوا لغياب سعر صرف)` : ""}.`}
        </span>
      )}
      {error && (
        <p role="alert" className="w-full text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
