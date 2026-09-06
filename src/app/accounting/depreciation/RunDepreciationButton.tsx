"use client";

import { useState, useTransition } from "react";
import { runDepreciationAction } from "../finance-actions";
import { Button } from "@/components/ui/button";

export default function RunDepreciationButton({ periodId }: { periodId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ postedCount: number; skippedCount: number } | null>(null);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        disabled={pending}
        onClick={() => {
          setError(null);
          setResult(null);
          startTransition(async () => {
            try {
              const r = await runDepreciationAction(periodId);
              setResult(r);
            } catch (e) {
              setError(e instanceof Error ? e.message : "حصل خطأ.");
            }
          });
        }}
      >
        {pending ? "جاري التشغيل..." : "تشغيل إهلاك الفترة"}
      </Button>
      {result && (
        <span className="text-sm text-emerald-700">
          {result.postedCount > 0
            ? `اترحّل إهلاك ${result.postedCount} أصل${result.skippedCount > 0 ? ` (${result.skippedCount} اتخطّى — اتعمل له إهلاك الفترة دي بالفعل أو مالوش قيمة متبقية)` : ""}.`
            : `مفيش أصول تستاهل إهلاك — كلها اتعمل لها الفترة دي بالفعل (${result.skippedCount} أصل) أو مفيش أصول نشطة.`}
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
