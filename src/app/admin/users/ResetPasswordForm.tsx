"use client";

import { useActionState } from "react";
import Link from "next/link";
import { resetUserPasswordAction, type ResetPasswordFormState } from "./actions";
import { Form } from "@/components/ui/form";

const initialState: ResetPasswordFormState = {};

export default function ResetPasswordForm({ userId }: { userId: string }) {
  const [state, formAction, pending] = useActionState(resetUserPasswordAction, initialState);

  return (
    <Form action={formAction} state={state} className="flex items-center gap-1.5">
      <input type="hidden" name="userId" value={userId} />
      <input
        name="password"
        type="text"
        placeholder="كلمة سر جديدة"
        disabled={pending}
        className="w-32 rounded-lg border border-neutral-300 bg-white px-2 py-1 text-xs outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
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
          {state.mfaRequired && (
            <>
              {" "}
              <Link href="/mfa/challenge?next=/admin/users" className="underline">
                تحقق دلوقتي
              </Link>
            </>
          )}
        </span>
      )}
    </Form>
  );
}
