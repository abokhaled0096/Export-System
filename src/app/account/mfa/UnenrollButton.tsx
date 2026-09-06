"use client";

import { useTransition } from "react";
import { unenrollFactor } from "./actions";

export default function UnenrollButton({ factorId }: { factorId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => unenrollFactor(factorId))}
      className="text-xs text-rose-600 hover:underline disabled:opacity-50"
    >
      {pending ? "..." : "إلغاء التفعيل"}
    </button>
  );
}
