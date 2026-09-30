"use client";

import { useActionState } from "react";
import { createDecisionLogEntry, type DecisionFormState } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form } from "@/components/ui/form";

const initialState: DecisionFormState = {};

export type UserOption = { id: string; label: string };

export default function DecisionForm({ users, currentUserId }: { users: UserOption[]; currentUserId: string }) {
  const [state, formAction, pending] = useActionState(createDecisionLogEntry, initialState);

  return (
    <Form action={formAction} state={state} className="grid gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-2">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="dec-title" className="text-xs">
          العنوان *
        </Label>
        <Input id="dec-title" name="title" />
        {state.errors?.title && <span className="text-xs text-destructive">{state.errors.title[0]}</span>}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="dec-date" className="text-xs">
          تاريخ القرار *
        </Label>
        <Input id="dec-date" name="decisionDate" type="date" />
        {state.errors?.decisionDate && <span className="text-xs text-destructive">{state.errors.decisionDate[0]}</span>}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="dec-by" className="text-xs">
          اتخذ القرار *
        </Label>
        <Select name="decidedBy" defaultValue={currentUserId}>
          <SelectTrigger id="dec-by">
            <SelectValue>{(value: string) => users.find((u) => u.id === value)?.label ?? "—"}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {users.map((u) => (
              <SelectItem key={u.id} value={u.id}>
                {u.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="dec-context" className="text-xs">
          السياق
        </Label>
        <Input id="dec-context" name="context" />
      </div>
      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <Label htmlFor="dec-outcome" className="text-xs">
          النتيجة
        </Label>
        <Input id="dec-outcome" name="outcome" />
      </div>
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "جاري التسجيل..." : "+ قرار"}
        </Button>
      </div>
      {state.formError && (
        <p role="alert" className="text-sm text-destructive sm:col-span-2">
          {state.formError}
        </p>
      )}
    </Form>
  );
}
