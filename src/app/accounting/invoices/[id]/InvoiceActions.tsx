"use client";

import { useState, useTransition } from "react";
import { issueInvoiceAction, cancelInvoiceAction } from "../../arap-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function InvoiceActions({
  invoiceId,
  status,
  needsFxRate,
  functionalCurrency,
  currency,
}: {
  invoiceId: string;
  status: string;
  needsFxRate: boolean;
  functionalCurrency?: string;
  currency: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fxRate, setFxRate] = useState("");

  function run(fn: (id: string) => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await fn(invoiceId);
      } catch (e) {
        setError(e instanceof Error ? e.message : "حصل خطأ.");
      }
    });
  }

  function runIssue() {
    setError(null);
    startTransition(async () => {
      try {
        await issueInvoiceAction(invoiceId, needsFxRate ? fxRate : undefined);
      } catch (e) {
        setError(e instanceof Error ? e.message : "حصل خطأ.");
      }
    });
  }

  const canIssue = status === "Draft";
  const canCancel = status !== "Paid" && status !== "Cancelled";

  return (
    <div className="flex flex-wrap items-center gap-2">
      {canIssue && needsFxRate && (
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">{`سعر الصرف (1 ${currency} = ؟ ${functionalCurrency})`}</label>
          <Input type="number" step="0.00000001" className="w-32" value={fxRate} onChange={(e) => setFxRate(e.target.value)} />
        </div>
      )}
      {canIssue && (
        <Button disabled={pending || (needsFxRate && !fxRate)} onClick={runIssue}>
          {pending ? "..." : "إصدار وترحيل القيد"}
        </Button>
      )}
      {canCancel && (
        <Button variant="outline" disabled={pending} onClick={() => run(cancelInvoiceAction)}>
          {pending ? "..." : "إلغاء (عكس القيد)"}
        </Button>
      )}
      {error && (
        <p role="alert" className="w-full text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
