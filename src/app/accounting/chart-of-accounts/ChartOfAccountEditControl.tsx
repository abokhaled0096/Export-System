"use client";

import { useActionState, useOptimistic, useState, useTransition } from "react";
import { updateChartOfAccountAction, toggleChartOfAccountActiveAction, type ChartOfAccountEditFormState } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Form } from "@/components/ui/form";

const initialState: ChartOfAccountEditFormState = {};

export default function ChartOfAccountEditControl({
  accountId,
  nameAr,
  nameEn,
  isActive,
}: {
  accountId: string;
  nameAr: string;
  nameEn: string;
  isActive: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [state, formAction, pending] = useActionState(updateChartOfAccountAction.bind(null, accountId), initialState);
  const [togglePending, startToggle] = useTransition();
  const [toggleError, setToggleError] = useState<string | null>(null);
  // Optimistic UI (BACKLOG.md § P3) — الحالة بتتقلب فورًا وقت الضغط، مش لما السيرفر يرد. لو
  // السيرفر رفض، optimisticActive بيرجع للقيمة الحقيقية (isActive) تلقائيًا لما الـtransition تخلص.
  const [optimisticActive, setOptimisticActive] = useOptimistic(isActive);

  const [prevState, setPrevState] = useState(state);
  if (state !== prevState) {
    setPrevState(state);
    if (state.success) setEditing(false);
  }

  if (!editing) {
    return (
      <span className="inline-flex items-center gap-1.5">
        {!optimisticActive && <Badge className="bg-neutral-200 text-neutral-700 hover:bg-neutral-200">موقوف</Badge>}
        <button type="button" className="text-xs text-primary hover:underline" onClick={() => setEditing(true)}>
          تعديل
        </button>
        <button
          type="button"
          className="text-xs text-muted-foreground hover:underline disabled:opacity-50"
          disabled={togglePending}
          onClick={() => {
            setToggleError(null);
            startToggle(async () => {
              setOptimisticActive(!optimisticActive);
              try {
                await toggleChartOfAccountActiveAction(accountId);
              } catch (e) {
                setToggleError(e instanceof Error ? e.message : "حصل خطأ.");
              }
            });
          }}
        >
          {optimisticActive ? "إيقاف" : "تفعيل"}
        </button>
        {toggleError && <span className="text-xs text-destructive">{toggleError}</span>}
      </span>
    );
  }

  return (
    <Form action={formAction} state={state} className="inline-flex items-center gap-1.5">
      <Input name="nameAr" defaultValue={nameAr} className="w-32" placeholder="الاسم بالعربي" />
      <Input name="nameEn" defaultValue={nameEn} className="w-32" placeholder="الاسم بالإنجليزي" />
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "..." : "حفظ"}
      </Button>
      <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>
        إلغاء
      </Button>
      {(state.errors?.nameAr || state.errors?.nameEn || state.formError) && (
        <span className="text-xs text-destructive">{state.errors?.nameAr?.[0] ?? state.errors?.nameEn?.[0] ?? state.formError}</span>
      )}
    </Form>
  );
}
