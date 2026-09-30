"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createPayment, type PaymentFormState } from "../arap-actions";
import { paymentDirectionLabel, paymentMethodLabel } from "@/lib/arapLabels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import CurrencySelect from "@/components/CurrencySelect";
import { useFormDialogClose } from "@/components/FormDialog";
import { Form } from "@/components/ui/form";

const initialState: PaymentFormState = {};
const directions = Object.keys(paymentDirectionLabel);
const methods = Object.keys(paymentMethodLabel);

export type PaymentOption = { id: string; label: string; currency?: string };

type Props = { bankAccounts: PaymentOption[]; companies: PaymentOption[]; suppliers: PaymentOption[] };

export default function PaymentForm({ bankAccounts, companies, suppliers }: Props) {
  const [state, formAction, pending] = useActionState(createPayment, initialState);
  // بترجّع null لو الفورم مش جوه نافذة — فالاستخدام في صفحة عادية بيفضل زي ما هو.
  const closeDialog = useFormDialogClose();
  const router = useRouter();
  const [direction, setDirection] = useState(directions[0]);
  const [bankAccountId, setBankAccountId] = useState(bankAccounts[0]?.id ?? "");
  // مفتاح واحد بيتولّد لحظة فتح الفورم — بيمنع دفعة مكرّرة لو المستخدم دبّس "+ دفعة" مرتين.
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  useEffect(() => {
    if (!state.paymentId) return;
    closeDialog?.();
    router.push(`/accounting/payments/${state.paymentId}`);
  }, [state.paymentId, router, closeDialog]);

  const selectedBank = bankAccounts.find((b) => b.id === bankAccountId);
  const isInbound = direction === "Inbound";

  if (bankAccounts.length === 0) {
    return (
      <p className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        لازم تضيف حساب بنكي واحد على الأقل قبل ما تسجّل دفعة.
      </p>
    );
  }

  return (
    <Form action={formAction} state={state} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="pay-dir" className="text-xs">
          الاتجاه *
        </Label>
        <Select name="direction" value={direction} onValueChange={(v) => setDirection(String(v))}>
          <SelectTrigger id="pay-dir">
            <SelectValue>{(value: string) => paymentDirectionLabel[value] ?? value}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {directions.map((d) => (
              <SelectItem key={d} value={d}>
                {paymentDirectionLabel[d]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isInbound && companies.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="pay-company" className="text-xs">
            العميل
          </Label>
          <Select name="companyId">
            <SelectTrigger id="pay-company">
              <SelectValue>{(value: string) => companies.find((c) => c.id === value)?.label ?? "— بدون —"}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {companies.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {!isInbound && suppliers.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="pay-supplier" className="text-xs">
            المورّد
          </Label>
          <Select name="supplierId">
            <SelectTrigger id="pay-supplier">
              <SelectValue>{(value: string) => suppliers.find((s) => s.id === value)?.label ?? "— بدون —"}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {suppliers.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="pay-bank" className="text-xs">
          الحساب البنكي *
        </Label>
        <Select name="bankAccountId" value={bankAccountId} onValueChange={(v) => setBankAccountId(String(v))}>
          <SelectTrigger id="pay-bank">
            <SelectValue>{(value: string) => bankAccounts.find((b) => b.id === value)?.label ?? "—"}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {bankAccounts.map((b) => (
              <SelectItem key={b.id} value={b.id}>
                {b.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {state.errors?.bankAccountId && <span className="text-xs text-destructive">{state.errors.bankAccountId[0]}</span>}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="pay-amount" className="text-xs">
          المبلغ *
        </Label>
        <Input id="pay-amount" name="amount" type="number" step="0.01" />
        {state.errors?.amount && <span className="text-xs text-destructive">{state.errors.amount[0]}</span>}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="pay-currency" className="text-xs">
          العملة *
        </Label>
        <CurrencySelect id="pay-currency" name="currency" defaultValue={selectedBank?.currency ?? "EGP"} key={selectedBank?.currency ?? "cur"} />
        <span className="text-[11px] text-muted-foreground">لازم تطابق عملة الفواتير اللي هتتخصّص عليها.</span>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="pay-method" className="text-xs">
          طريقة الدفع
        </Label>
        <Select name="paymentMethod" defaultValue={methods[0]}>
          <SelectTrigger id="pay-method">
            <SelectValue>{(value: string) => paymentMethodLabel[value] ?? value}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {methods.map((m) => (
              <SelectItem key={m} value={m}>
                {paymentMethodLabel[m]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="pay-date" className="text-xs">
          تاريخ الدفعة *
        </Label>
        <Input id="pay-date" name="paymentDate" type="date" />
        {state.errors?.paymentDate && <span className="text-xs text-destructive">{state.errors.paymentDate[0]}</span>}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="pay-ref" className="text-xs">
          المرجع
        </Label>
        <Input id="pay-ref" name="reference" placeholder="رقم الحوالة / الشيك" />
      </div>

      <div className="flex items-end">
        <Button type="submit" disabled={pending}>
          {pending ? "جاري التسجيل..." : "+ دفعة"}
        </Button>
      </div>

      {state.formError && (
        <p role="alert" className="sm:col-span-2 lg:col-span-3 text-sm text-destructive">
          {state.formError}
        </p>
      )}
    </Form>
  );
}
