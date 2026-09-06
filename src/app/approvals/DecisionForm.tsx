"use client";

import { useState } from "react";
import { useActionState } from "react";
import Link from "next/link";
import { approveRequest, rejectRequest, type DecideApprovalState } from "./actions";

const initialState: DecideApprovalState = {};

export default function DecisionForm({ approvalId, dealId }: { approvalId: string; dealId: string }) {
  const [showReject, setShowReject] = useState(false);
  const [approveState, approveAction, approvePending] = useActionState(
    approveRequest.bind(null, approvalId),
    initialState
  );
  const [rejectState, rejectAction, rejectPending] = useActionState(
    rejectRequest.bind(null, approvalId),
    initialState
  );

  return (
    <div className="mt-3">
      <div className="flex items-center gap-2">
        <Link href={`/deals/${dealId}`} className="text-xs text-emerald-700 hover:underline">
          عرض الصفقة
        </Link>
        <form action={approveAction}>
          <button
            type="submit"
            disabled={approvePending}
            className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
          >
            {approvePending ? "جاري الاعتماد..." : "اعتمد"}
          </button>
        </form>
        <button
          type="button"
          onClick={() => setShowReject((v) => !v)}
          className="rounded-lg border border-rose-300 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50"
        >
          رفض
        </button>
      </div>
      {approveState.formError && (
        <p className="mt-1 text-xs text-rose-600">
          {approveState.formError}
          {approveState.mfaRequired && (
            <>
              {" "}
              <Link href={`/mfa/challenge?next=/approvals`} className="underline">
                تحقق دلوقتي
              </Link>
            </>
          )}
        </p>
      )}

      {showReject && (
        <form action={rejectAction} className="mt-2 flex items-center gap-2">
          <input
            type="text"
            name="reason"
            placeholder="سبب الرفض *"
            className="flex-1 rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-xs outline-none focus:border-rose-500"
          />
          <button
            type="submit"
            disabled={rejectPending}
            className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-rose-700 disabled:opacity-50"
          >
            {rejectPending ? "..." : "تأكيد الرفض"}
          </button>
        </form>
      )}
      {rejectState.formError && (
        <p className="mt-1 text-xs text-rose-600">
          {rejectState.formError}
          {rejectState.mfaRequired && (
            <>
              {" "}
              <Link href={`/mfa/challenge?next=/approvals`} className="underline">
                تحقق دلوقتي
              </Link>
            </>
          )}
        </p>
      )}
    </div>
  );
}
