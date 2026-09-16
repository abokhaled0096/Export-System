"use client";

import { useState, useTransition } from "react";
import { deletePaymentAllocationAction } from "../../arap-actions";
import { Button } from "@/components/ui/button";

export default function DeleteAllocationButton({ allocationId }: { allocationId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run() {
    setError(null);
    startTransition(async () => {
      try {
        await deletePaymentAllocationAction(allocationId);
      } catch (e) {
        setError(e instanceof Error ? e.message : "حصل خطأ.");
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button variant="outline" size="sm" disabled={pending} onClick={run}>
        {pending ? "..." : "إلغاء التخصيص"}
      </Button>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );
}
