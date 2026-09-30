"use client";

import { useActionState } from "react";
import { createChartOfAccount, type ChartOfAccountFormState } from "../actions";
import { accountTypeLabel, normalBalanceLabel } from "@/lib/accountingLabels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import CurrencySelect from "@/components/CurrencySelect";
import { Form } from "@/components/ui/form";

const initialState: ChartOfAccountFormState = {};
const accountTypes = Object.keys(accountTypeLabel);
const normalBalances = Object.keys(normalBalanceLabel);

export default function ChartOfAccountForm({ accounts }: { accounts: { id: string; accountCode: string; nameAr: string }[] }) {
  const [state, formAction, pending] = useActionState(createChartOfAccount, initialState);

  return (
    <Form action={formAction} state={state} className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="accountCode" className="text-xs">
          كود الحساب *
        </Label>
        <Input id="accountCode" name="accountCode" placeholder="1010" className="w-24" />
        {state.errors?.accountCode && <span className="text-xs text-destructive">{state.errors.accountCode[0]}</span>}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="nameAr" className="text-xs">
          الاسم (عربي) *
        </Label>
        <Input id="nameAr" name="nameAr" className="w-36" />
        {state.errors?.nameAr && <span className="text-xs text-destructive">{state.errors.nameAr[0]}</span>}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="nameEn" className="text-xs">
          الاسم (إنجليزي) *
        </Label>
        <Input id="nameEn" name="nameEn" className="w-36" />
        {state.errors?.nameEn && <span className="text-xs text-destructive">{state.errors.nameEn[0]}</span>}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="accountType" className="text-xs">
          النوع
        </Label>
        <Select name="accountType" defaultValue={accountTypes[0]}>
          <SelectTrigger id="accountType" className="w-32">
            <SelectValue>{(value: string) => accountTypeLabel[value] ?? value}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {accountTypes.map((t) => (
              <SelectItem key={t} value={t}>
                {accountTypeLabel[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="normalBalance" className="text-xs">
          الرصيد الطبيعي
        </Label>
        <Select name="normalBalance" defaultValue={normalBalances[0]}>
          <SelectTrigger id="normalBalance" className="w-28">
            <SelectValue>{(value: string) => normalBalanceLabel[value] ?? value}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {normalBalances.map((b) => (
              <SelectItem key={b} value={b}>
                {normalBalanceLabel[b]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {accounts.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="parentAccountId" className="text-xs">
            الحساب الأب
          </Label>
          <Select name="parentAccountId">
            <SelectTrigger id="parentAccountId" className="w-40">
              <SelectValue placeholder="—">
                {(value: string) => {
                  const acc = accounts.find((a) => a.id === value);
                  return acc ? `${acc.accountCode} — ${acc.nameAr}` : value;
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {accounts.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.accountCode} — {a.nameAr}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="coa-currency" className="text-xs">
          العملة
        </Label>
        <CurrencySelect id="coa-currency" name="currency" className="w-20" />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "جاري الإضافة..." : "+ حساب"}
      </Button>
      {state.formError && <p role="alert" className="w-full text-sm text-destructive">{state.formError}</p>}
    </Form>
  );
}
