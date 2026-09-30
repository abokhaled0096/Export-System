"use client";

import { useActionState, useState, useTransition } from "react";
import { updateBankAccountAction, toggleBankAccountActiveAction, type BankAccountEditFormState } from "../../arap-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Form } from "@/components/ui/form";

const initialState: BankAccountEditFormState = {};

/** اسم الحساب/البنك بس قابلين للتعديل — currency/openingBalance عمدًا لأ (راجع تعليق
 * updateBankAccountAction). التفعيل/الإيقاف فعل منفصل بلا فورم (زرار واحد، نفس نمط
 * StageTransitionButtons — تعديل فوري بلا حاجة لتأكيد نص). */
export default function BankAccountEditForm({
  bankAccountId,
  accountName,
  bankName,
  isActive,
}: {
  bankAccountId: string;
  accountName: string;
  bankName: string;
  isActive: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [state, formAction, pending] = useActionState(updateBankAccountAction.bind(null, bankAccountId), initialState);
  const [togglePending, startToggle] = useTransition();
  const [toggleError, setToggleError] = useState<string | null>(null);

  const [prevState, setPrevState] = useState(state);
  if (state !== prevState) {
    setPrevState(state);
    if (state.success) setEditing(false);
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      {!editing ? (
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="text-foreground/80">اسم الحساب: {accountName}</span>
          <span className="text-foreground/80">البنك: {bankName}</span>
          <Badge className={isActive ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100" : "bg-neutral-200 text-neutral-700 hover:bg-neutral-200"}>
            {isActive ? "نشط" : "موقوف"}
          </Badge>
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
            تعديل
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={togglePending}
            onClick={() => {
              setToggleError(null);
              startToggle(async () => {
                try {
                  await toggleBankAccountActiveAction(bankAccountId);
                } catch (e) {
                  setToggleError(e instanceof Error ? e.message : "حصل خطأ.");
                }
              });
            }}
          >
            {togglePending ? "..." : isActive ? "إيقاف الحساب" : "تفعيل الحساب"}
          </Button>
          {state.success && <span className="text-xs text-emerald-700">اتحفظ بنجاح ✓</span>}
          {toggleError && <span className="text-xs text-destructive">{toggleError}</span>}
        </div>
      ) : (
        <Form action={formAction} state={state} className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ba-edit-name" className="text-xs">
              اسم الحساب *
            </Label>
            <Input id="ba-edit-name" name="accountName" defaultValue={accountName} className="w-48" />
            {state.errors?.accountName && <span className="text-xs text-destructive">{state.errors.accountName[0]}</span>}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ba-edit-bank" className="text-xs">
              البنك *
            </Label>
            <Input id="ba-edit-bank" name="bankName" defaultValue={bankName} className="w-48" />
            {state.errors?.bankName && <span className="text-xs text-destructive">{state.errors.bankName[0]}</span>}
          </div>
          <Button type="submit" disabled={pending}>
            {pending ? "جاري الحفظ..." : "حفظ"}
          </Button>
          <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
            إلغاء
          </Button>
          {state.formError && <p className="w-full text-sm text-destructive">{state.formError}</p>}
        </Form>
      )}
    </div>
  );
}
