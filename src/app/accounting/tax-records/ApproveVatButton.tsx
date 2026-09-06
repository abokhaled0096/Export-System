"use client";

import { useState, useTransition } from "react";
import { approveVatFilingAction } from "../finance-actions";
import { Button } from "@/components/ui/button";

export default function ApproveVatButton({
  periodId,
  taxType,
}: {
  periodId: string;
  taxType: "VATInput" | "VATOutput";
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (done) return <span className="text-sm text-emerald-700">اتقدّم الإقرار ✓</span>;

  return (
    <div className="flex items-center gap-2">
      <Button
        size="sm"
        disabled={pending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            try {
              await approveVatFilingAction(periodId, taxType);
              setDone(true);
            } catch (e) {
              setError(e instanceof Error ? e.message : "حصل خطأ.");
            }
          });
        }}
      >
        {pending ? "..." : "اعتماد كإقرار"}
      </Button>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );
}
