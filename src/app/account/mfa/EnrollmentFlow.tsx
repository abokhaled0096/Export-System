"use client";

import { useActionState, useState, useTransition } from "react";
import { startEnrollment, verifyEnrollment, type VerifyEnrollmentState, type EnrollmentData } from "./actions";

const initialState: VerifyEnrollmentState = {};

export default function EnrollmentFlow() {
  const [enrollment, setEnrollment] = useState<EnrollmentData | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const [starting, startTransition] = useTransition();

  const boundVerify = enrollment
    ? verifyEnrollment.bind(null, enrollment.factorId)
    : async (_s: VerifyEnrollmentState) => _s;
  const [state, formAction, pending] = useActionState(boundVerify, initialState);

  if (state.success) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
        ✓ اتفعّل التحقق بخطوتين بنجاح.{" "}
        <a href="/account/mfa" className="underline">
          حدّث الصفحة
        </a>
      </div>
    );
  }

  if (!enrollment) {
    return (
      <div>
        <button
          type="button"
          disabled={starting}
          onClick={() =>
            startTransition(async () => {
              const result = await startEnrollment();
              if ("error" in result) setStartError(result.error);
              else setEnrollment(result);
            })
          }
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-[var(--brand-dark)] disabled:opacity-50"
        >
          {starting ? "جاري البدء..." : "فعّل التحقق بخطوتين"}
        </button>
        {startError && <p className="mt-2 text-sm text-rose-600">{startError}</p>}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <p className="text-sm text-neutral-700">
        امسح الكود ده بتطبيق مصادقة (Google Authenticator, Authy...) أو أدخل المفتاح يدويًا:
      </p>
      {/* eslint-disable-next-line @next/next/no-img-element -- qrCode مفروضة data URI مؤقتة من Supabase، مش أصل ثابت. */}
      <img src={enrollment.qrCode} alt="QR كود التحقق بخطوتين" className="mt-3 h-40 w-40" />
      <p className="mt-2 break-all font-mono text-xs text-neutral-500">{enrollment.secret}</p>

      <form action={formAction} className="mt-4 flex items-center gap-2">
        <input
          type="text"
          name="code"
          placeholder="الكود المكوّن من 6 أرقام"
          maxLength={6}
          className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-primary"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-[var(--brand-dark)] disabled:opacity-50"
        >
          {pending ? "جاري التحقق..." : "تأكيد"}
        </button>
      </form>
      {state.formError && <p role="alert" className="mt-2 text-sm text-rose-600">{state.formError}</p>}
    </div>
  );
}
