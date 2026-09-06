"use client";

import { useActionState } from "react";
import { login, type LoginFormState } from "./actions";

const initialState: LoginFormState = {};

export default function LoginForm({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState(login, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-5 w-full max-w-sm">
      <input type="hidden" name="next" value={next ?? ""} />
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-neutral-700">الإيميل</span>
        <input
          name="email"
          type="email"
          required
          className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-neutral-700">كلمة المرور</span>
        <input
          name="password"
          type="password"
          required
          className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
        />
      </label>

      {state.formError && (
        <p role="alert" className="text-sm text-rose-600 bg-rose-50 rounded-lg px-3 py-2">{state.formError}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
      >
        {pending ? "جاري الدخول..." : "تسجيل الدخول"}
      </button>
      <p className="text-xs text-neutral-400 text-center">
        الحسابات بتتضاف بمعرفة مدير النظام — مفيش تسجيل ذاتي (نطاق P1).
      </p>
    </form>
  );
}
