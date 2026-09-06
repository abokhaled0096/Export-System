"use client";

import { useState, useTransition } from "react";
import { clearPaymentAction, bouncePaymentAction } from "../../arap-actions";
import { Button } from "@/components/ui/button";

export default function PaymentActions({
  paymentId,
  status,
  direction,
}: {
  paymentId: string;
  status: string;
  direction: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div className="flex flex-wrap items-center gap-2">
      {status === "Pending" && (
        <Button disabled={pending} onClick={() => run(clearPaymentAction)}>
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
