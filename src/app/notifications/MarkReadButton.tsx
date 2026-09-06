"use client";

import { useState, useTransition } from "react";
import { markNotificationReadAction } from "../governance/actions";
import { Button } from "@/components/ui/button";

export default function MarkReadButton({ notificationId }: { notificationId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (done) return <span className="text-xs text-muted-foreground">اتعلّم كمقروء</span>;

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
              await markNotificationReadAction(notificationId);
              setDone(true);
            } catch (e) {
              setError(e instanceof Error ? e.message : "حصل خطأ.");
            }
          });
        }}
      >
        {pending ? "..." : "تعليم كمقروء"}
      </Button>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );
}
