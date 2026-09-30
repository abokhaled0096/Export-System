"use client";

import { useActionState } from "react";
import { createSoDRule, type SoDRuleFormState } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Form } from "@/components/ui/form";

const initialState: SoDRuleFormState = {};

export default function SoDRuleForm() {
  const [state, formAction, pending] = useActionState(createSoDRule, initialState);

  return (
    <Form action={formAction} state={state} className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="sod-a1" className="text-xs">
          الفعل الأول *
        </Label>
        <Input id="sod-a1" name="action1" placeholder="Payment.Create" className="w-40" />
        {state.errors?.action1 && <span className="text-xs text-destructive">{state.errors.action1[0]}</span>}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="sod-a2" className="text-xs">
          الفعل الثاني *
        </Label>
        <Input id="sod-a2" name="action2" placeholder="Payment.Approve" className="w-40" />
        {state.errors?.action2 && <span className="text-xs text-destructive">{state.errors.action2[0]}</span>}
      </div>
      <div className="flex items-center gap-2 pb-2">
        <Checkbox id="sod-diff" name="mustBeDifferentUser" defaultChecked />
        <Label htmlFor="sod-diff" className="text-xs">
          لازم يكونوا أشخاص مختلفين
        </Label>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "جاري الإضافة..." : "+ قاعدة"}
      </Button>
      <p className="w-full text-xs text-muted-foreground">
        دلوقتي القاعدة الوحيدة المُنفَّذة فعليًا على مستوى القاعدة هي Payment.Create/Payment.Approve — راجع BACKLOG.md لباقي الأزواج.
      </p>
      {state.formError && (
        <p role="alert" className="w-full text-sm text-destructive">
          {state.formError}
        </p>
      )}
    </Form>
  );
}
