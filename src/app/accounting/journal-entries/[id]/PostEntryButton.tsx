"use client";

import { useState, useTransition } from "react";
import { postJournalEntryAction } from "../../actions";
import { Button } from "@/components/ui/button";

export default function PostEntryButton({ journalEntryId }: { journalEntryId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-1.5">
      <Button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            try {
              await postJournalEntryAction(journalEntryId);
            } catch (e) {
              setError(e instanceof Error ? e.message : "حصل خطأ أثناء الترحيل.");
            }
          })
        }
      >
        {pending ? "جاري الترحيل..." : "ترحيل القيد"}
      </Button>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
