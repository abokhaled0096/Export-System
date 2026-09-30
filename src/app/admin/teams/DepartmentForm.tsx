"use client";

import { useActionState } from "react";
import { createDepartment, type CreateDepartmentFormState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Form } from "@/components/ui/form";

const initialState: CreateDepartmentFormState = {};

export default function DepartmentForm() {
  const [state, formAction, pending] = useActionState(createDepartment, initialState);

  return (
    <Form action={formAction} state={state} className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="dept-name" className="text-xs">
          اسم القسم
        </Label>
        <Input id="dept-name" name="name" className="w-64" placeholder="المبيعات" />
        {state.errors?.name && <span className="text-xs text-destructive">{state.errors.name[0]}</span>}
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "جاري الحفظ..." : "+ قسم جديد"}
      </Button>
      {state.formError && (
        <p role="alert" className="w-full text-sm text-destructive">
          {state.formError}
        </p>
      )}
    </Form>
  );
}
