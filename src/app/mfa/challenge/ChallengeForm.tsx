"use client";

import { useActionState } from "react";
import { verifyStepUp, type StepUpState } from "./actions";

const initialState: StepUpState = {};

export default function ChallengeForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState(verifyStepUp.bind(null, next), initialState);

  return (
    <form action={formAction} className="mt-6 flex items-center gap-2">
      <input
        type="text"
        name="code"
        placeholder="الكود المكوّن من 6 أرقام"
        maxLength={6}
        autoFocus
        className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-600"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
      >
        {pending ? "جاري التحقق..." : "تأكيد"}
      </button>
      {state.formError && <p role="alert" className="text-sm text-rose-600">{state.formError}</p>}
    </form>
  );
}
