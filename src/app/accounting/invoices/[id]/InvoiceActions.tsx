"use client";

import { useState, useTransition } from "react";
import { issueInvoiceAction, cancelInvoiceAction } from "../../arap-actions";
import { Button } from "@/components/ui/button";

export default function InvoiceActions({ invoiceId, status }: { invoiceId: string; status: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

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

  const canIssue = status === "Draft";
  const canCancel = status !== "Paid" && status !== "Cancelled";

  return (
    <div className="flex flex-wrap items-center gap-2">
      {canIssue && (
        <Button disabled={pending} onClick={() => run(issueInvoiceAction)}>
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
