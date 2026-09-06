"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createReconciliation, type ReconciliationFormState } from "../treasury-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const initialState: ReconciliationFormState = {};

export type AccountOption = { id: string; label: string };

export default function ReconciliationForm({ accounts }: { accounts: AccountOption[] }) {
  const [state, formAction, pending] = useActionState(createReconciliation, initialState);
  const router = useRouter();

  useEffect(() => {
    if (state.reconciliationId) router.push(`/accounting/reconciliations/${state.reconciliationId}`);
  }, [state.reconciliationId, router]);

  if (accounts.length === 0) {
    return (
      <p className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        لازم تضيف حساب بنكي واحد على الأقل قبل ما تبدأ مطابقة.
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="rec-account" className="text-xs">
          الحساب البنكي *
        </Label>
        <Select name="bankAccountId" defaultValue={accounts[0]?.id}>
          <SelectTrigger id="rec-account" className="w-64">
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
        {state.errors?.bankAccountId && <span className="text-xs text-destructive">{state.errors.bankAccountId[0]}</span>}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="rec-date" className="text-xs">
          تاريخ الكشف *
        </Label>
        <Input id="rec-date" name="statementDate" type="date" className="w-40" />
        {state.errors?.statementDate && <span className="text-xs text-destructive">{state.errors.statementDate[0]}</span>}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="rec-balance" className="text-xs">
          رصيد الكشف *
        </Label>
        <Input id="rec-balance" name="statementBalance" type="number" step="0.01" className="w-36" />
        {state.errors?.statementBalance && <span className="text-xs text-destructive">{state.errors.statementBalance[0]}</span>}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="rec-notes" className="text-xs">
          ملاحظات
        </Label>
        <Input id="rec-notes" name="notes" className="w-48" />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "جاري الإنشاء..." : "+ مطابقة"}
      </Button>
      <p className="w-full text-xs text-muted-foreground">
        الرصيد الدفتري بيتحسب من النظام تلقائيًا (رصيد افتتاحي + الحركات لغاية تاريخ الكشف) — مش إدخال يدوي.
      </p>
      {state.formError && (
        <p role="alert" className="w-full text-sm text-destructive">
          {state.formError}
        </p>
      )}
    </form>
  );
}
