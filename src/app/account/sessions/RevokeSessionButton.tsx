"use client";

import { useState, useTransition } from "react";
import { revokeSessionAction } from "./actions";
import { Button } from "@/components/ui/button";

export default function RevokeSessionButton({ sessionId }: { sessionId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() => {
          if (!confirm("تسجيل خروج من الجهاز ده؟")) return;
          setError(null);
          startTransition(async () => {
            try {
              await revokeSessionAction(sessionId);
            } catch (e) {
              setError(e instanceof Error ? e.message : "حصل خطأ.");
            }
          });
        }}
      >
        {pending ? "..." : "تسجيل خروج من الجهاز ده"}
      </Button>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
