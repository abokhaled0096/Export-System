"use client";

import { useState, useTransition } from "react";
import { decideMasterDataChangeRequestAction } from "../actions";
import { Button } from "@/components/ui/button";

export default function DecisionButtons({ requestId }: { requestId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function decide(status: "Approved" | "Rejected") {
    setError(null);
    startTransition(async () => {
      try {
        await decideMasterDataChangeRequestAction(requestId, status);
      } catch (e) {
        setError(e instanceof Error ? e.message : "حصل خطأ.");
      }
    });
  }

  return (
    <div className="flex items-center gap-2">
      <Button size="sm" disabled={pending} onClick={() => decide("Approved")}>
        {pending ? "..." : "اعتماد"}
      </Button>
      <Button size="sm" variant="outline" disabled={pending} onClick={() => decide("Rejected")}>
        رفض
      </Button>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );
}
