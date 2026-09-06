"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { reverseJournalEntryAction } from "../../actions";
import { Button } from "@/components/ui/button";

export default function ReverseEntryButton({ journalEntryId }: { journalEntryId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  return (
    <div className="flex flex-col gap-1.5">
      <Button
        type="button"
        variant="outline"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            try {
              const reversalId = await reverseJournalEntryAction(journalEntryId);
              router.push(`/accounting/journal-entries/${reversalId}`);
            } catch (e) {
              setError(e instanceof Error ? e.message : "حصل خطأ أثناء عكس القيد.");
            }
          })
        }
      >
        {pending ? "جاري العكس..." : "عكس القيد"}
      </Button>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
