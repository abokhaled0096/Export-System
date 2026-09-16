"use client";

import { useState, useTransition } from "react";
import { recomputeSalesTargetActualAction } from "./actions";
import { Button } from "@/components/ui/button";

export default function RecomputeActualButton({ targetId }: { targetId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-start gap-1">
      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const r = await recomputeSalesTargetActualAction(targetId);
            if (r.formError) setError(r.formError);
          });
        }}
      >
        {pending ? "..." : "إعادة حساب"}
      </Button>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );
}
