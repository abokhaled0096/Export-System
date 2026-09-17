"use client";

import { useActionState, useState, useTransition } from "react";
import {
  disburseLoanAction,
  markLoanDefaultedAction,
  payLoanInstallmentAction,
  createLoanInstallment,
  generateLoanScheduleAction,
  type InstallmentFormState,
} from "../../treasury-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: InstallmentFormState = {};

export function DisburseButton({
  loanId,
  disbursed,
  needsFxRate,
  currency,
  functionalCurrency,
}: {
  loanId: string;
  disbursed: boolean;
  needsFxRate: boolean;
  currency: string;
  functionalCurrency?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fxRate, setFxRate] = useState("");

  if (disbursed) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {needsFxRate && (
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">{`سعر الصرف (1 ${currency} = ؟ ${functionalCurrency})`}</label>
          <Input type="number" step="0.00000001" className="w-32" value={fxRate} onChange={(e) => setFxRate(e.target.value)} />
        </div>
      )}
      <Button
        disabled={pending || (needsFxRate && !fxRate)}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            try {
              await disburseLoanAction(loanId, needsFxRate ? fxRate : undefined);
            } catch (e) {
              setError(e instanceof Error ? e.message : "حصل خطأ.");
            }
          });
        }}
      >
        {pending ? "..." : "صرف القرض وترحيل القيد"}
      </Button>
      <span className="text-xs text-muted-foreground">بيسجّل إيداع في الحساب البنكي وقيد: مدين نقدية / دائن قروض دائنة.</span>
      {error && (
        <p role="alert" className="w-full text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

export function MarkDefaultedButton({ loanId, lenderName }: { loanId: string; lenderName: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant="destructive"
        disabled={pending}
        onClick={() => {
          if (!confirm(`تصنيف القرض من ${lenderName} كمتعثّر — قرار نهائي بلا مسار رجوع في الواجهة. متأكد؟`)) return;
          setError(null);
          startTransition(async () => {
            try {
              await markLoanDefaultedAction(loanId);
            } catch (e) {
              setError(e instanceof Error ? e.message : "حصل خطأ.");
            }
          });
        }}
      >
        {pending ? "..." : "تصنيف كمتعثّر"}
      </Button>
      {error && (
        <p role="alert" className="w-full text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

export function PayInstallmentButton({
  installmentId,
  needsFxRate,
  currency,
  functionalCurrency,
}: {
  installmentId: string;
  needsFxRate: boolean;
  currency: string;
  functionalCurrency?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fxRate, setFxRate] = useState("");

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-1.5">
        {needsFxRate && (
          <Input
            type="number"
            step="0.00000001"
            placeholder={`سعر 1 ${currency}=؟${functionalCurrency}`}
            className="w-28"
            value={fxRate}
            onChange={(e) => setFxRate(e.target.value)}
          />
        )}
        <Button
          variant="outline"
          size="sm"
          disabled={pending || (needsFxRate && !fxRate)}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              try {
                await payLoanInstallmentAction(installmentId, needsFxRate ? fxRate : undefined);
              } catch (e) {
                setError(e instanceof Error ? e.message : "حصل خطأ.");
              }
            });
          }}
        >
          {pending ? "..." : "سداد"}
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

export function GenerateScheduleButton({ loanId }: { loanId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-4">
      <Button
        disabled={pending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            try {
              await generateLoanScheduleAction(loanId);
            } catch (e) {
              setError(e instanceof Error ? e.message : "حصل خطأ.");
            }
          });
        }}
      >
        {pending ? "جاري التوليد..." : "توليد جدول الأقساط تلقائيًا"}
      </Button>
      <span className="text-xs text-muted-foreground">مرة واحدة بس — لو الجدول غلط، اتشل الأقساط الحالية وولّده تاني.</span>
      {error && (
        <p role="alert" className="w-full text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

export function InstallmentForm({ loanId, currency }: { loanId: string; currency: string }) {
  const action = createLoanInstallment.bind(null, loanId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="inst-due" className="text-xs">
          تاريخ الاستحقاق *
        </Label>
        <Input id="inst-due" name="dueDate" type="date" className="w-40" />
        {state.errors?.dueDate && <span className="text-xs text-destructive">{state.errors.dueDate[0]}</span>}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="inst-principal" className="text-xs">
          حصة الأصل ({currency}) *
        </Label>
        <Input id="inst-principal" name="principalPortion" type="number" step="0.01" className="w-32" />
        {state.errors?.principalPortion && <span className="text-xs text-destructive">{state.errors.principalPortion[0]}</span>}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="inst-interest" className="text-xs">
          حصة الفوائد
        </Label>
        <Input id="inst-interest" name="interestPortion" type="number" step="0.01" defaultValue="0" className="w-32" />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "جاري الإضافة..." : "+ قسط"}
      </Button>
      <p className="w-full text-xs text-muted-foreground">
        فصل الأصل عن الفوائد ضروري محاسبيًا — الأصل بيقلّل الالتزام، والفوائد مصروف تمويل في قائمة الدخل.
      </p>
      {state.formError && (
        <p role="alert" className="w-full text-sm text-destructive">
          {state.formError}
        </p>
      )}
    </form>
  );
}
