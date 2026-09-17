"use client";

import { useActionState } from "react";
import { payTaxRecordAction, type TaxPaymentFormState } from "../finance-actions";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";

const initialState: TaxPaymentFormState = {};

export type BankAccountOption = { id: string; label: string };

export default function PayTaxButton({
  taxRecordId,
  bankAccounts,
  needsFxRate,
  currency,
  functionalCurrency,
}: {
  taxRecordId: string;
  bankAccounts: BankAccountOption[];
  needsFxRate: boolean;
  currency: string;
  functionalCurrency?: string;
}) {
  const action = payTaxRecordAction.bind(null, taxRecordId);
  const [state, formAction, pending] = useActionState(action, initialState);

  if (bankAccounts.length === 0) {
    return <span className="text-xs text-muted-foreground">لازم حساب بنكي للسداد</span>;
  }

  return (
    <form action={formAction} className="flex items-center gap-2">
      <Select name="bankAccountId" defaultValue={bankAccounts[0]?.id}>
        <SelectTrigger className="w-40">
          <SelectValue>{(value: string) => bankAccounts.find((a) => a.id === value)?.label ?? "—"}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {bankAccounts.map((a) => (
            <SelectItem key={a.id} value={a.id}>
              {a.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input name="paymentDate" type="date" className="w-36" />
      {needsFxRate && (
        <Input name="fxRate" type="number" step="0.00000001" placeholder={`سعر 1 ${currency}=؟${functionalCurrency}`} className="w-36" />
      )}
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        {pending ? "..." : "تسجيل السداد"}
      </Button>
      {state.formError && <span className="text-xs text-destructive">{state.formError}</span>}
    </form>
  );
}
