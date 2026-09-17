"use client";

import { useState, useTransition } from "react";
import { approveCommissionEntryAction, payCommissionEntryAction } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function CommissionEntryActions({
  dealId,
  entryId,
  status,
  currency,
  needsFxRate,
  functionalCurrency,
}: {
  dealId: string;
  entryId: string;
  status: string;
  currency: string;
  needsFxRate: boolean;
  functionalCurrency?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fxRate, setFxRate] = useState("");

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

  function runPay() {
    setError(null);
    startTransition(async () => {
      try {
        await payCommissionEntryAction(dealId, entryId, needsFxRate ? fxRate : undefined);
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
        <>
          {needsFxRate && (
            <Input
              type="number"
              step="0.00000001"
              placeholder={`سعر 1 ${currency}=؟${functionalCurrency}`}
              className="w-32"
              value={fxRate}
              onChange={(e) => setFxRate(e.target.value)}
            />
          )}
          <Button size="sm" disabled={pending || (needsFxRate && !fxRate)} onClick={runPay}>
            {pending ? "..." : "سداد وترحيل القيد"}
          </Button>
        </>
      )}
      {error && (
        <p role="alert" className="w-full text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
