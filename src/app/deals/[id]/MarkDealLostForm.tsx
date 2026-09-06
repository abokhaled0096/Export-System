"use client";

import { useActionState, useState } from "react";
import { markDealLost, type MarkDealLostFormState } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: MarkDealLostFormState = {};

export default function MarkDealLostForm({ dealId }: { dealId: string }) {
  const [open, setOpen] = useState(false);
  const action = markDealLost.bind(null, dealId);
  const [state, formAction, pending] = useActionState(action, initialState);

  if (!open) {
    return (
      <Button type="button" variant="link" className="text-destructive" onClick={() => setOpen(true)}>
        أعلن الصفقة خسرانة
      </Button>
    );
  }

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="lostReason" className="text-xs">
          سبب الخسارة *
        </Label>
        <Input id="lostReason" name="lostReason" className="w-64" />
        {state.errors?.lostReason && (
          <span className="text-xs text-destructive">{state.errors.lostReason[0]}</span>
        )}
      </div>
      <Button type="submit" variant="destructive" disabled={pending}>
        {pending ? "جاري الحفظ..." : "تأكيد الخسارة"}
      </Button>
      {state.formError && <p role="alert" className="w-full text-sm text-destructive">{state.formError}</p>}
    </form>
  );
}
