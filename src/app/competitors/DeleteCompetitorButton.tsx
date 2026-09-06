"use client";

import { useState, useTransition } from "react";
import { deleteCompetitorAction } from "./actions";
import { Button } from "@/components/ui/button";

export default function DeleteCompetitorButton({ competitorId }: { competitorId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant="ghost"
        size="sm"
        className="text-muted-foreground hover:text-destructive"
        disabled={pending}
        onClick={() => {
          if (!confirm("شيل المنافس ده من القائمة؟")) return;
          setError(null);
          startTransition(async () => {
            try {
              await deleteCompetitorAction(competitorId);
            } catch (e) {
              setError(e instanceof Error ? e.message : "حصل خطأ.");
            }
          });
        }}
      >
        {pending ? "..." : "شيل"}
      </Button>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
