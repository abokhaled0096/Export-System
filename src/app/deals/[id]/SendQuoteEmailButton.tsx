"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { sendQuoteEmail, type SendQuoteEmailState } from "../actions";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";

const initialState: SendQuoteEmailState = {};

export default function SendQuoteEmailButton({ quoteId }: { quoteId: string }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(sendQuoteEmail.bind(null, quoteId), initialState);

  useEffect(() => {
    if (state.success) router.refresh();
  }, [state, router]);

  return (
    <Form action={formAction} state={state} className="inline-flex flex-col items-start gap-1">
      <Button type="submit" variant="link" className="h-auto p-0" disabled={pending}>
        {pending ? "جاري الإرسال..." : "إرسال بالإيميل"}
      </Button>
      {state.formError && <p role="alert" className="text-xs text-destructive">{state.formError}</p>}
    </Form>
  );
}
