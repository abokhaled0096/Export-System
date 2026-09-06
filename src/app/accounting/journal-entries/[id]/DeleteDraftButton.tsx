"use client";

import { useState, useTransition } from "react";
import { deleteDraftJournalEntryAction } from "../../actions";
import { Button } from "@/components/ui/button";

export default function DeleteDraftButton({ journalEntryId }: { journalEntryId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-1.5">
      <Button
        type="button"
        variant="ghost"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            try {
              await deleteDraftJournalEntryAction(journalEntryId);
            } catch (e) {
              setError(e instanceof Error ? e.message : "حصل خطأ أثناء حذف المسودة.");
            }
          })
        }
      >
        {pending ? "جاري الحذف..." : "حذف المسودة"}
      </Button>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
