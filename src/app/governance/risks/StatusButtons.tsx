"use client";

import { useState, useTransition } from "react";
import { updateRiskStatusAction } from "../actions";
import { Button } from "@/components/ui/button";

const NEXT_STATUS: Record<string, "Mitigated" | "Closed" | null> = {
  Open: "Mitigated",
  Mitigated: "Closed",
  Closed: null,
};

const NEXT_LABEL: Record<string, string> = {
  Open: "تعليم كمخفَّف",
  Mitigated: "إقفال",
};

export default function StatusButtons({ riskId, status }: { riskId: string; status: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const next = NEXT_STATUS[status];

  if (!next) return null;

  return (
    <div className="flex items-center gap-2">
      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            try {
              await updateRiskStatusAction(riskId, next);
            } catch (e) {
              setError(e instanceof Error ? e.message : "حصل خطأ.");
            }
          });
        }}
      >
        {pending ? "..." : NEXT_LABEL[status]}
      </Button>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );
}
