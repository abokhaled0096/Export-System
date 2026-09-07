"use client";

import { useActionState } from "react";
import { toggleUserActiveAction, type ToggleActiveFormState } from "./actions";

const initialState: ToggleActiveFormState = {};

export default function ToggleActiveForm({ userId, isActive }: { userId: string; isActive: boolean }) {
  const [state, formAction, pending] = useActionState(toggleUserActiveAction, initialState);

  return (
    <form action={formAction} className="flex items-center gap-1.5">
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="isActive" value={String(!isActive)} />
      <button
        type="submit"
        disabled={pending}
        className={`rounded-lg border px-2 py-1 text-xs disabled:opacity-50 ${
          isActive
            ? "border-rose-300 text-rose-700 hover:bg-rose-50"
            : "border-emerald-300 text-emerald-700 hover:bg-emerald-50"
        }`}
      >
        {pending ? "..." : isActive ? "تعطيل" : "تفعيل"}
      </button>
      {state.formError && (
        <span role="alert" className="text-xs text-rose-600">
          {state.formError}
        </span>
      )}
    </form>
  );
}
