"use client";

import { useState, useTransition } from "react";
import { toggleSoDRuleAction } from "../actions";
import { Button } from "@/components/ui/button";

export default function ToggleRuleButton({ ruleId, isActive }: { ruleId: string; isActive: boolean }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-2">
      <Button
        size="sm"
        variant={isActive ? "outline" : "default"}
        disabled={pending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            try {
              await toggleSoDRuleAction(ruleId, !isActive);
            } catch (e) {
              setError(e instanceof Error ? e.message : "حصل خطأ.");
            }
          });
        }}
      >
        {pending ? "..." : isActive ? "إيقاف" : "تفعيل"}
      </Button>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );
}
