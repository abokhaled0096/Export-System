"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createLoan, type LoanFormState } from "../treasury-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const initialState: LoanFormState = {};

export type LoanAccountOption = { id: string; label: string };

export default function LoanForm({ accounts }: { accounts: LoanAccountOption[] }) {
  const [state, formAction, pending] = useActionState(createLoan, initialState);
  const router = useRouter();

  useEffect(() => {
    if (state.loanId) router.push(`/accounting/loans/${state.loanId}`);
  }, [state.loanId, router]);

  if (accounts.length === 0) {
    return (
      <p className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        لازم تضيف حساب بنكي واحد على الأقل — القرض لازم ينزل في حساب.
      </p>
    );
  }

  return (
    <form action={formAction} className="grid gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="loan-lender" className="text-xs">
          الجهة المقرضة *
        </Label>
        <Input id="loan-lender" name="lenderName" />
        {state.errors?.lenderName && <span className="text-xs text-destructive">{state.errors.lenderName[0]}</span>}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="loan-account" className="text-xs">
          الحساب البنكي *
        </Label>
        <Select name="bankAccountId" defaultValue={accounts[0]?.id}>
          <SelectTrigger id="loan-account">
            <SelectValue>{(value: string) => accounts.find((a) => a.id === value)?.label ?? "—"}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {accounts.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-[11px] text-muted-foreground">القرض بياخد عملة الحساب.</span>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="loan-principal" className="text-xs">
          أصل القرض *
        </Label>
        <Input id="loan-principal" name="principal" type="number" step="0.01" />
        {state.errors?.principal && <span className="text-xs text-destructive">{state.errors.principal[0]}</span>}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="loan-rate" className="text-xs">
          سعر الفائدة %
        </Label>
        <Input id="loan-rate" name="interestRatePct" type="number" step="0.001" />
        <span className="text-[11px] text-muted-foreground">للتوثيق — جدول الأقساط بيتدخّل يدويًا.</span>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="loan-start" className="text-xs">
          تاريخ البداية *
        </Label>
        <Input id="loan-start" name="startDate" type="date" />
        {state.errors?.startDate && <span className="text-xs text-destructive">{state.errors.startDate[0]}</span>}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="loan-maturity" className="text-xs">
          تاريخ الاستحقاق *
        </Label>
        <Input id="loan-maturity" name="maturityDate" type="date" />
        {state.errors?.maturityDate && <span className="text-xs text-destructive">{state.errors.maturityDate[0]}</span>}
      </div>

      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <Label htmlFor="loan-collateral" className="text-xs">
          الضمان
        </Label>
        <Input id="loan-collateral" name="collateral" />
      </div>

      <div className="flex items-end">
        <Button type="submit" disabled={pending}>
          {pending ? "جاري التسجيل..." : "+ قرض"}
        </Button>
      </div>

      {state.formError && (
        <p role="alert" className="text-sm text-destructive sm:col-span-2 lg:col-span-3">
          {state.formError}
        </p>
      )}
    </form>
  );
}
