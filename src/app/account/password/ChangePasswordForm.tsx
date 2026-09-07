"use client";

import { useActionState, useEffect, useRef } from "react";
import { updateMyPasswordAction, type ChangePasswordFormState } from "./actions";

const initialState: ChangePasswordFormState = {};

export default function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState(updateMyPasswordAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state.success]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="currentPassword" className="text-sm text-foreground">
          كلمة السر الحالية
        </label>
        <input
          id="currentPassword"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
        {state.errors?.currentPassword && <span className="text-xs text-destructive">{state.errors.currentPassword[0]}</span>}
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="newPassword" className="text-sm text-foreground">
          كلمة السر الجديدة
        </label>
        <input
          id="newPassword"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
        {state.errors?.newPassword && <span className="text-xs text-destructive">{state.errors.newPassword[0]}</span>}
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="confirmPassword" className="text-sm text-foreground">
          تأكيد كلمة السر الجديدة
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
        {state.errors?.confirmPassword && <span className="text-xs text-destructive">{state.errors.confirmPassword[0]}</span>}
      </div>
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "جاري التغيير..." : "تغيير كلمة السر"}
      </button>
      {state.success && <p className="text-sm text-emerald-700">تم تغيير كلمة السر بنجاح ✓</p>}
      {state.formError && (
        <p role="alert" className="text-sm text-destructive">
          {state.formError}
        </p>
      )}
    </form>
  );
}
