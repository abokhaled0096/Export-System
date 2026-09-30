"use client";

import { useActionState } from "react";
import { assignUserRole, type AssignRoleFormState } from "./actions";
import { Form } from "@/components/ui/form";

const initialState: AssignRoleFormState = {};

export default function RoleSelectForm({
  userId,
  currentRoleId,
  roles,
  isSelf,
}: {
  userId: string;
  currentRoleId: string;
  roles: { id: string; name: string }[];
  isSelf: boolean;
}) {
  const [state, formAction, pending] = useActionState(assignUserRole, initialState);

  return (
    <Form action={formAction} state={state} className="flex items-center gap-2">
      <input type="hidden" name="userId" value={userId} />
      <select
        name="roleId"
        defaultValue={currentRoleId}
        disabled={pending}
        className="rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
      >
        {roles.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name}
          </option>
        ))}
      </select>
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-[var(--brand-dark)] disabled:opacity-50"
      >
        {pending ? "جاري الحفظ..." : "حفظ"}
      </button>
      {isSelf && <span className="text-xs text-amber-600">ده حسابك — احذر لو غيّرت دورك</span>}
      {state.formError && <span role="alert" className="text-xs text-rose-600">{state.formError}</span>}
    </Form>
  );
}
