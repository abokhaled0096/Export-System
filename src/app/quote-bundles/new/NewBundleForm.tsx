"use client";

import { useActionState } from "react";
import { createQuoteBundle, type QuoteBundleFormState } from "../actions";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";

const statusLabel: Record<string, string> = { Draft: "مسودة", PendingApproval: "بانتظار الموافقة", Sent: "مُرسَل" };

type EligibleQuote = {
  id: string;
  version: number;
  currency: string;
  unitPrice: { toFixed: (n: number) => string };
  status: string;
  deal: { product: { nameAr: string } };
};

const initialState: QuoteBundleFormState = {};

export default function NewBundleForm({ customerId, quotes }: { customerId: string; quotes: EligibleQuote[] }) {
  const [state, formAction, pending] = useActionState(createQuoteBundle, initialState);

  return (
    <Form action={formAction} state={state} className="mt-6 flex flex-col gap-3">
      <input type="hidden" name="customerId" value={customerId} />
      <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4">
        {quotes.map((q) => (
          <label key={q.id} className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-3 py-2 text-sm hover:bg-muted/30">
            <span className="flex items-center gap-3">
              <input type="checkbox" name="quoteIds" value={q.id} className="size-4" />
              <span className="text-foreground">
                {q.deal.product.nameAr} <span className="font-mono text-xs text-muted-foreground">v{q.version}</span>
              </span>
            </span>
            <span className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="font-mono">
                {q.unitPrice.toFixed(2)} {q.currency}
              </span>
              <span>{statusLabel[q.status] ?? q.status}</span>
            </span>
          </label>
        ))}
      </div>
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "جاري الإنشاء..." : "إنشاء الحزمة"}
        </Button>
      </div>
      {state.formError && (
        <p role="alert" className="text-sm text-destructive">
          {state.formError}
        </p>
      )}
    </Form>
  );
}
