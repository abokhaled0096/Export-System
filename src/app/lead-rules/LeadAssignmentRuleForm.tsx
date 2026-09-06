"use client";

import { useActionState } from "react";
import { createLeadAssignmentRule, type LeadAssignmentRuleFormState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const initialState: LeadAssignmentRuleFormState = {};

export default function LeadAssignmentRuleForm({
  users,
  teams,
}: {
  users: { id: string; fullName: string }[];
  teams: { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState(createLeadAssignmentRule, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
      {users.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="assignToUserId" className="text-xs">
            التعيين لمستخدم
          </Label>
          <Select name="assignToUserId">
            <SelectTrigger id="assignToUserId" className="w-36">
              <SelectValue placeholder="—">{(value: string) => users.find((u) => u.id === value)?.fullName ?? value}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {users.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.fullName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      {teams.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="assignToTeamId" className="text-xs">
            التعيين لفريق
          </Label>
          <Select name="assignToTeamId">
            <SelectTrigger id="assignToTeamId" className="w-36">
              <SelectValue placeholder="—">{(value: string) => teams.find((t) => t.id === value)?.name ?? value}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {teams.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="priority" className="text-xs">
          الأولوية
        </Label>
        <Input id="priority" name="priority" type="number" min="0" step="1" defaultValue={0} className="w-20" />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "جاري الإضافة..." : "+ قاعدة توزيع"}
      </Button>
      {state.formError && <p role="alert" className="w-full text-sm text-destructive">{state.formError}</p>}
    </form>
  );
}
