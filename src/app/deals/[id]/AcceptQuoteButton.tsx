"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { acceptQuote } from "../actions";
import { Button } from "@/components/ui/button";

export default function AcceptQuoteButton({ quoteId }: { quoteId: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <Button
      type="button"
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await acceptQuote(quoteId);
          router.refresh();
        })
      }
    >
      {pending ? "جاري القبول..." : "اقبل العرض"}
    </Button>
  );
}
