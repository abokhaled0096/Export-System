"use client";

import { useActionState, useState } from "react";
import { createBankTransaction, type BankTransactionFormState } from "../../treasury-actions";
import { bankTransactionTypeLabel } from "@/lib/treasuryLabels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form } from "@/components/ui/form";

const initialState: BankTransactionFormState = {};
const types = Object.keys(bankTransactionTypeLabel);

export default function BankTransactionForm({
  bankAccountId,
  currency,
  needsFxRate,
  functionalCurrency,
}: {
  bankAccountId: string;
  currency: string;
  needsFxRate: boolean;
  functionalCurrency?: string;
}) {
  const action = createBankTransaction.bind(null, bankAccountId);
  const [state, formAction, pending] = useActionState(action, initialState);
  // مفتاح واحد بيتولّد لحظة فتح الفورم — بيمنع حركة مكرّرة لو المستخدم دبّس "+ حركة" مرتين.
  // الفورم هنا بيفضل مفتوح بعد كل إضافة (بلا redirect) عشان يسمح بإضافة حركات متتالية، فلازم
  // نولّد مفتاح جديد بعد كل نجاح — وإلا ثاني حركة حقيقية هتتحسب "مكررة" غلط وتتراجع بصمت.
  // تعديل الحالة أثناء الـrender نفسه (نمط React الموصى بيه لـ"تصفير حالة لما حالة تانية تتغيّر")
  // بدل useEffect — تعديل setState جوه Effect بيعمل renders متتالية غير لازمة.
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const [prevState, setPrevState] = useState(state);
  if (state !== prevState) {
    setPrevState(state);
    if (state !== initialState && !state.errors && !state.formError) setIdempotencyKey(crypto.randomUUID());
  }

  return (
    <Form action={formAction} state={state} className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="bt-date" className="text-xs">
          التاريخ *
        </Label>
        <Input id="bt-date" name="transactionDate" type="date" className="w-40" />
        {state.errors?.transactionDate && <span className="text-xs text-destructive">{state.errors.transactionDate[0]}</span>}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="bt-type" className="text-xs">
          النوع *
        </Label>
        <Select name="transactionType" defaultValue={types[0]}>
          <SelectTrigger id="bt-type" className="w-36">
            <SelectValue>{(value: string) => bankTransactionTypeLabel[value] ?? value}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {types.map((t) => (
              <SelectItem key={t} value={t}>
                {bankTransactionTypeLabel[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="bt-amount" className="text-xs">
          المبلغ ({currency}) *
        </Label>
        <Input id="bt-amount" name="amount" type="number" step="0.01" className="w-32" />
        {state.errors?.amount && <span className="text-xs text-destructive">{state.errors.amount[0]}</span>}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="bt-ref" className="text-xs">
          المرجع
        </Label>
        <Input id="bt-ref" name="reference" className="w-36" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="bt-desc" className="text-xs">
          البيان
        </Label>
        <Input id="bt-desc" name="description" className="w-48" />
      </div>
      {needsFxRate && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="bt-fxrate" className="text-xs">
            {`سعر الصرف (1 ${currency} = ؟ ${functionalCurrency})`}
          </Label>
          <Input id="bt-fxrate" name="fxRate" type="number" step="0.00000001" className="w-32" />
          <span className="text-[11px] text-muted-foreground">مطلوب بس للمصروف/الفائدة (الترحيل الفوري).</span>
        </div>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? "جاري التسجيل..." : "+ حركة"}
      </Button>
      <p className="w-full text-xs text-muted-foreground">
        المبلغ موجب دايمًا — الاتجاه بيتحدد من نوع الحركة. المصروفات والفوائد بتترحّل للدفتر فورًا؛ الإيداع والسحب بيترحّلوا عبر الدفعة المضاهاة.
      </p>
      {state.formError && (
        <p role="alert" className="w-full text-sm text-destructive">
          {state.formError}
        </p>
      )}
    </Form>
  );
}
