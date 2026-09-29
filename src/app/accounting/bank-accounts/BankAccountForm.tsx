"use client";

import { useActionState } from "react";
import { createBankAccount, type BankAccountFormState } from "../arap-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import CurrencySelect from "@/components/CurrencySelect";

const initialState: BankAccountFormState = {};

export default function BankAccountForm() {
  const [state, formAction, pending] = useActionState(createBankAccount, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="accountName" className="text-xs">
          اسم الحساب *
        </Label>
        <Input id="accountName" name="accountName" className="w-48" />
        {state.errors?.accountName && <span className="text-xs text-destructive">{state.errors.accountName[0]}</span>}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="bankName" className="text-xs">
          البنك *
        </Label>
        <Input id="bankName" name="bankName" className="w-40" />
        {state.errors?.bankName && <span className="text-xs text-destructive">{state.errors.bankName[0]}</span>}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ba-currency" className="text-xs">
          العملة *
        </Label>
        <CurrencySelect id="ba-currency" name="currency" defaultValue="EGP" className="w-20" />
        {state.errors?.currency && <span className="text-xs text-destructive">{state.errors.currency[0]}</span>}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="openingBalance" className="text-xs">
          الرصيد الافتتاحي
        </Label>
        <Input id="openingBalance" name="openingBalance" type="number" step="0.01" defaultValue="0" className="w-32" />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "جاري الإضافة..." : "+ حساب بنكي"}
      </Button>
      <p className="w-full text-xs text-muted-foreground">
        🔒 رقم الحساب والـIBAN والـSWIFT بيتسجّلوا مشفّرين من صفحة تفاصيل الحساب بعد الإنشاء — محتاجين تحقق بخطوتين (MFA).
      </p>
      {state.formError && (
        <p role="alert" className="w-full text-sm text-destructive">
          {state.formError}
        </p>
      )}
      {state.requestSubmitted && (
        <p className="w-full text-sm text-emerald-700">
          ✓ معندكش صلاحية إضافة حساب بنكي مباشرة — طلبك اتسجّل وهيتراجع.{" "}
          <a href="/governance/change-requests" className="underline">
            متابعة الطلب
          </a>
        </p>
      )}
    </form>
  );
}
