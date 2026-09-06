"use client";

import { useState, useTransition } from "react";
import { approveCommissionEntryAction, payCommissionEntryAction } from "../actions";
import { Button } from "@/components/ui/button";

export default function CommissionEntryActions({ dealId, entryId, status }: { dealId: string; entryId: string; status: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(fn: (dealId: string, entryId: string) => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await fn(dealId, entryId);
      } catch (e) {
        setError(e instanceof Error ? e.message : "حصل خطأ.");
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {status === "Accrued" && (
        <Button size="sm" variant="outline" disabled={pending} onClick={() => run(approveCommissionEntryAction)}>
          {pending ? "..." : "اعتماد"}
        </Button>
      )}
      {status === "Approved" && (
        <Button size="sm" disabled={pending} onClick={() => run(payCommissionEntryAction)}>
          {pending ? "..." : "سداد وترحيل القيد"}
        </Button>
      )}
      {error && (
        <p role="alert" className="w-full text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
