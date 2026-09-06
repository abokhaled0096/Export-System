"use client";

import { useTransition } from "react";
import { advanceAccountingPeriodStatus } from "../actions";
import { Button } from "@/components/ui/button";

const nextStatusLabel: Record<string, { next: "SoftClosed" | "HardClosed"; label: string }> = {
  Open: { next: "SoftClosed", label: "قفل مبدئي" },
  SoftClosed: { next: "HardClosed", label: "قفل نهائي" },
};

export default function ClosePeriodButton({ periodId, status }: { periodId: string; status: string }) {
  const [pending, startTransition] = useTransition();
  const next = nextStatusLabel[status];
  if (!next) return null;

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() => startTransition(() => advanceAccountingPeriodStatus(periodId, next.next))}
    >
      {pending ? "جاري القفل..." : next.label}
    </Button>
  );
}
