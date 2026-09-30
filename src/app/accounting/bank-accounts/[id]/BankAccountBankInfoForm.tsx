"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { updateBankAccountBankInfoAction, type BankAccountBankInfoFormState } from "../../arap-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Form } from "@/components/ui/form";

const initialState: BankAccountBankInfoFormState = {};

/** بلا عرض القيمة الفعلية أبدًا — بادج "مسجّل" بس. نفس نمط SupplierBankInfoForm/
 * TransportTripPhoneCell بالحرف (تشفير Vault + MFA + تعديل جزئي آمن). */
export default function BankAccountBankInfoForm({
  bankAccountId,
  hasAccountNumber,
  hasIban,
  hasSwift,
}: {
  bankAccountId: string;
  hasAccountNumber: boolean;
  hasIban: boolean;
  hasSwift: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [state, formAction, pending] = useActionState(updateBankAccountBankInfoAction.bind(null, bankAccountId), initialState);

  const [prevState, setPrevState] = useState(state);
  if (state !== prevState) {
    setPrevState(state);
    if (state.success) setEditing(false);
  }

  if (!editing) {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-4 text-sm">
        <span className="text-foreground/80">رقم الحساب: {hasAccountNumber ? "🔒 مسجّل" : "— غير مسجّل"}</span>
        <span className="text-foreground/80">IBAN: {hasIban ? "🔒 مسجّل" : "— غير مسجّل"}</span>
        <span className="text-foreground/80">SWIFT: {hasSwift ? "🔒 مسجّل" : "— غير مسجّل"}</span>
        <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
          تعديل
        </Button>
        {state.success && <span className="text-xs text-emerald-700">اتحفظ بنجاح ✓</span>}
      </div>
    );
  }

  return (
    <Form action={formAction} state={state} className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ba-accnum" className="text-xs">
          رقم الحساب
        </Label>
        <Input id="ba-accnum" name="accountNumber" placeholder={hasAccountNumber ? "🔒 مسجّل — سيب فاضي عشان تسيبه زي ما هو" : ""} className="w-48 font-mono" dir="ltr" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ba-iban" className="text-xs">
          IBAN
        </Label>
        <Input id="ba-iban" name="iban" placeholder={hasIban ? "🔒 مسجّل — سيب فاضي عشان تسيبه زي ما هو" : ""} className="w-64 font-mono" dir="ltr" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ba-swift" className="text-xs">
          SWIFT
        </Label>
        <Input id="ba-swift" name="swift" placeholder={hasSwift ? "🔒 مسجّل — سيب فاضي عشان تسيبه زي ما هو" : ""} className="w-32 font-mono" dir="ltr" />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "جاري الحفظ..." : "حفظ"}
      </Button>
      <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
        إلغاء
      </Button>
      {state.errors?.accountNumber && <span className="w-full text-xs text-destructive">{state.errors.accountNumber[0]}</span>}
      {state.errors?.iban && <span className="w-full text-xs text-destructive">{state.errors.iban[0]}</span>}
      {state.errors?.swift && <span className="w-full text-xs text-destructive">{state.errors.swift[0]}</span>}
      {state.formError && (
        <p role="alert" className="w-full text-sm text-destructive">
          {state.formError}
          {state.mfaRequired && (
            <>
              {" "}
              <Link href={`/mfa/challenge?next=/accounting/bank-accounts/${bankAccountId}`} className="underline">
                تحقق دلوقتي
              </Link>
            </>
          )}
        </p>
      )}
    </Form>
  );
}
