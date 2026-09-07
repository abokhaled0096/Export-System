"use client";

import { useActionState } from "react";
import { resetUserPasswordAction, type ResetPasswordFormState } from "./actions";

const initialState: ResetPasswordFormState = {};

export default function ResetPasswordForm({ userId }: { userId: string }) {
  const [state, formAction, pending] = useActionState(resetUserPasswordAction, initialState);

  return (
    <form action={formAction} className="flex items-center gap-1.5">
      <input type="hidden" name="userId" value={userId} />
      <input
        name="password"
        type="text"
        placeholder="كلمة سر جديدة"
        disabled={pending}
        className="w-32 rounded-lg border border-neutral-300 bg-white px-2 py-1 text-xs outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg border border-neutral-300 px-2 py-1 text-xs text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
      >
        {pending ? "..." : "إعادة تعيين"}
      </button>
      {state.success && <span className="text-xs text-emerald-700">تم ✓</span>}
      {(state.formError || state.errors?.password) && (
        <span role="alert" className="text-xs text-rose-600">
          {state.formError ?? state.errors?.password?.[0]}
        </span>
      )}
    </form>
  );
}
