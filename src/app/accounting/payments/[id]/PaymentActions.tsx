"use client";

import { useState, useTransition } from "react";
import { clearPaymentAction, bouncePaymentAction } from "../../arap-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function PaymentActions({
  paymentId,
  status,
  direction,
  needsFxRate,
  functionalCurrency,
  currency,
}: {
  paymentId: string;
  status: string;
  direction: string;
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
        await fn(paymentId);
      } catch (e) {
        setError(e instanceof Error ? e.message : "حصل خطأ.");
      }
    });
  }

  function runClear() {
    setError(null);
    startTransition(async () => {
      try {
        await clearPaymentAction(paymentId, needsFxRate ? fxRate : undefined);
      } catch (e) {
        setError(e instanceof Error ? e.message : "حصل خطأ.");
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {status === "Pending" && needsFxRate && (
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">{`سعر الصرف (1 ${currency} = ؟ ${functionalCurrency})`}</label>
          <Input type="number" step="0.00000001" className="w-32" value={fxRate} onChange={(e) => setFxRate(e.target.value)} />
        </div>
      )}
      {status === "Pending" && (
        <Button disabled={pending || (needsFxRate && !fxRate)} onClick={runClear}>
          {pending ? "..." : direction === "Inbound" ? "تأكيد التحصيل وترحيل القيد" : "تأكيد السداد وترحيل القيد"}
        </Button>
      )}
      {status === "Cleared" && (
        <Button variant="outline" disabled={pending} onClick={() => run(bouncePaymentAction)}>
          {pending ? "..." : "تسجيل ارتداد (عكس القيد)"}
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
