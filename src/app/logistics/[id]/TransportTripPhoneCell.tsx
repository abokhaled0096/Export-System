"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { updateTransportTripDriverPhoneAction, type TransportTripDriverPhoneFormState } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form } from "@/components/ui/form";

const initialState: TransportTripDriverPhoneFormState = {};

/** بادج "🔒 مسجّل" بس — بلا عرض الرقم الفعلي أبدًا (نفس مبدأ SupplierBankInfoForm). خلية جدول
 * مضغوطة عمدًا (رحلات النقل معروضة كصفوف جدول، مش كروت تفصيلية). */
export default function TransportTripPhoneCell({
  tripId,
  shipmentId,
  hasDriverPhone,
}: {
  tripId: string;
  shipmentId: string;
  hasDriverPhone: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [state, formAction, pending] = useActionState(updateTransportTripDriverPhoneAction.bind(null, tripId), initialState);

  const [prevState, setPrevState] = useState(state);
  if (state !== prevState) {
    setPrevState(state);
    if (state.success) setEditing(false);
  }

  if (!editing) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-foreground/80">{hasDriverPhone ? "🔒 مسجّل" : "—"}</span>
        <Button size="sm" variant="ghost" className="h-6 px-1.5 text-xs" onClick={() => setEditing(true)}>
          تعديل
        </Button>
      </div>
    );
  }

  return (
    <Form action={formAction} state={state} className="flex flex-col gap-1">
      <div className="flex items-center gap-1">
        <Input
          name="driverPhone"
          placeholder={hasDriverPhone ? "🔒 مسجّل" : "رقم التليفون"}
          className="h-7 w-28 text-xs"
          dir="ltr"
        />
        <Button type="submit" size="sm" className="h-7 px-2 text-xs" disabled={pending}>
          {pending ? "..." : "حفظ"}
        </Button>
        <Button type="button" size="sm" variant="ghost" className="h-7 px-1.5 text-xs" onClick={() => setEditing(false)}>
          إلغاء
        </Button>
      </div>
      {state.errors?.driverPhone && <span className="text-[11px] text-destructive">{state.errors.driverPhone[0]}</span>}
      {state.formError && (
        <span className="text-[11px] text-destructive">
          {state.formError}
          {state.mfaRequired && (
            <>
              {" "}
              <Link href={`/mfa/challenge?next=/logistics/${shipmentId}`} className="underline">
                تحقق دلوقتي
              </Link>
            </>
          )}
        </span>
      )}
    </Form>
  );
}
