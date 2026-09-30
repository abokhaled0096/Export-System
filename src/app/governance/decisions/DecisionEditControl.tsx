"use client";

import { useActionState, useState } from "react";
import { updateDecisionLogEntryAction, type DecisionEditFormState } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form } from "@/components/ui/form";

const initialState: DecisionEditFormState = {};

export default function DecisionEditControl({
  entryId,
  title,
  context,
  outcome,
}: {
  entryId: string;
  title: string;
  context: string | null;
  outcome: string | null;
}) {
  const [editing, setEditing] = useState(false);
  const [state, formAction, pending] = useActionState(updateDecisionLogEntryAction.bind(null, entryId), initialState);

  const [prevState, setPrevState] = useState(state);
  if (state !== prevState) {
    setPrevState(state);
    if (state.success) setEditing(false);
  }

  if (!editing) {
    return (
      <button type="button" className="text-xs text-primary hover:underline" onClick={() => setEditing(true)}>
        تعديل
      </button>
    );
  }

  return (
    <Form action={formAction} state={state} className="flex flex-col gap-1.5 rounded-lg border border-border bg-secondary/40 p-2">
      <Input name="title" defaultValue={title} className="w-56" placeholder="العنوان" />
      {state.errors?.title && <span className="text-xs text-destructive">{state.errors.title[0]}</span>}
      <Textarea name="context" defaultValue={context ?? ""} className="w-56" placeholder="السياق" />
      <Textarea name="outcome" defaultValue={outcome ?? ""} className="w-56" placeholder="النتيجة" />
      <div className="flex items-center gap-1.5">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "..." : "حفظ"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>
          إلغاء
        </Button>
      </div>
      {state.formError && <span className="text-xs text-destructive">{state.formError}</span>}
    </Form>
  );
}
