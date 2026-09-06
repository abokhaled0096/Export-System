"use client";

import { useActionState } from "react";
import { assignUserTeam, type AssignUserTeamFormState } from "./actions";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const initialState: AssignUserTeamFormState = {};

const NO_TEAM = "__none__";

export default function TeamAssignForm({
  userId,
  currentTeamId,
  teams,
}: {
  userId: string;
  currentTeamId: string | null;
  teams: { id: string; label: string }[];
}) {
  const [state, formAction, pending] = useActionState(assignUserTeam, initialState);

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="userId" value={userId} />
      <Select name="teamId" defaultValue={currentTeamId ?? NO_TEAM}>
        <SelectTrigger className="w-44">
          <SelectValue placeholder="— بلا فريق —">
            {(value: string | null) =>
              !value || value === NO_TEAM ? "— بلا فريق —" : teams.find((t) => t.id === value)?.label ?? value
            }
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NO_TEAM}>— بلا فريق —</SelectItem>
          {teams.map((t) => (
            <SelectItem key={t.id} value={t.id}>
              {t.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        {pending ? "جاري الحفظ..." : "حفظ"}
      </Button>
      {state.formError && <span role="alert" className="text-xs text-destructive">{state.formError}</span>}
    </form>
  );
}
