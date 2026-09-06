"use client";

import { useActionState, useState } from "react";
import { updateReconciliationStatementBalanceAction, type UpdateStatementBalanceFormState } from "../../treasury-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: UpdateStatementBalanceFormState = {};

/** تصحيح رصيد/تاريخ/ملاحظات الكشف قبل الإقفال بس — الكارت الثابت العادي بيظهر لو المطابقة
 * مقفولة (isClosed)، الفورم بيظهر بدل الزرار لو المستخدم ضغط تعديل. تعديل التاريخ بيفك أي
 * حركة كانت مضمومة وبقت بعد التاريخ الجديد تلقائيًا (راجع updateReconciliationStatementBalanceAction).
 * notes كان بيتسجّل وقت الإنشاء بس مايتعرضش في صفحة التفاصيل خالص — بيانات محفوظة بس مش
 * مستغَلّة، اتصلح هنا كجزء من نفس الكارت. */
export default function StatementBalanceCard({
  reconciliationId,
  statementBalance,
  statementDate,
  notes,
  isClosed,
}: {
  reconciliationId: string;
  statementBalance: string;
  statementDate: string;
  notes: string | null;
  isClosed: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [state, formAction, pending] = useActionState(updateReconciliationStatementBalanceAction.bind(null, reconciliationId), initialState);

  const [prevState, setPrevState] = useState(state);
  if (state !== prevState) {
    setPrevState(state);
    if (state.success) setEditing(false);
  }

  if (isClosed || !editing) {
    return (
      <div className="rounded-xl border border-border bg-card p-5">
        <p className="text-xs text-muted-foreground">رصيد الكشف (من البنك)</p>
        <p className="mt-1 font-mono text-2xl font-semibold text-foreground">{statementBalance}</p>
        <p className="mt-1 text-xs text-muted-foreground">بتاريخ {statementDate}</p>
        {notes && <p className="mt-1 text-xs text-foreground/80">ملاحظات: {notes}</p>}
        {!isClosed && (
          <Button size="sm" variant="outline" className="mt-2" onClick={() => setEditing(true)}>
            تعديل
          </Button>
        )}
        {state.success && <p className="mt-1 text-xs text-emerald-700">اتحفظ بنجاح ✓</p>}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <p className="text-xs text-muted-foreground">رصيد الكشف (من البنك)</p>
      <form action={formAction} className="mt-2 flex flex-col gap-2">
        <Input name="statementBalance" type="number" step="0.01" defaultValue={statementBalance} className="font-mono" />
        {state.errors?.statementBalance && <span className="text-xs text-destructive">{state.errors.statementBalance[0]}</span>}
        <Input name="statementDate" type="date" defaultValue={statementDate} />
        {state.errors?.statementDate && <span className="text-xs text-destructive">{state.errors.statementDate[0]}</span>}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="rec-edit-notes" className="text-xs">
            ملاحظات
          </Label>
          <Input id="rec-edit-notes" name="notes" defaultValue={notes ?? ""} />
        </div>
        <div className="flex gap-2">
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "جاري الحفظ..." : "حفظ"}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>
            إلغاء
          </Button>
        </div>
        {state.formError && <p className="text-xs text-destructive">{state.formError}</p>}
      </form>
    </div>
  );
}
