"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { removeQuoteFromBundleAction } from "../actions";
import { Button } from "@/components/ui/button";

export default function RemoveQuoteButton({ quoteId }: { quoteId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant="ghost"
        size="sm"
        className="text-muted-foreground hover:text-destructive"
        disabled={pending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            try {
              const { bundleDeleted } = await removeQuoteFromBundleAction(quoteId);
              if (bundleDeleted) router.push("/quote-bundles");
            } catch (e) {
              setError(e instanceof Error ? e.message : "حصل خطأ.");
            }
          });
        }}
      >
        {pending ? "..." : "شيل من الحزمة"}
      </Button>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
