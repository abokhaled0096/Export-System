"use client";

import { useState, useTransition } from "react";
import { deleteWorkflowDefinitionAction } from "../actions";
import { Button } from "@/components/ui/button";

export default function DeleteWorkflowDefinitionButton({ workflowDefinitionId }: { workflowDefinitionId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

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
              await deleteWorkflowDefinitionAction(workflowDefinitionId);
            } catch (e) {
              setError(e instanceof Error ? e.message : "حصل خطأ.");
            }
          });
        }}
      >
        {pending ? "..." : "حذف"}
      </Button>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );
}
