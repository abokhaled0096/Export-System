"use client";

import { useActionState } from "react";
import { createTeam, type CreateTeamFormState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const initialState: CreateTeamFormState = {};

type Option = { id: string; label: string };

export default function TeamForm({ departments, users }: { departments: Option[]; users: Option[] }) {
  const [state, formAction, pending] = useActionState(createTeam, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="team-name" className="text-xs">
          اسم الفريق
        </Label>
        <Input id="team-name" name="name" className="w-48" placeholder="فريق مبيعات ألمانيا" />
        {state.errors?.name && <span className="text-xs text-destructive">{state.errors.name[0]}</span>}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="team-departmentId" className="text-xs">
          القسم
        </Label>
        <Select name="departmentId" defaultValue={departments[0]?.id}>
          <SelectTrigger id="team-departmentId" className="w-48">
            <SelectValue placeholder="اختر قسم">
              {(value: string | null) => (value ? departments.find((d) => d.id === value)?.label ?? value : "اختر قسم")}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {departments.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {d.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {state.errors?.departmentId && (
          <span className="text-xs text-destructive">{state.errors.departmentId[0]}</span>
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="team-managerId" className="text-xs">
          مدير الفريق
        </Label>
        <Select name="managerId">
          <SelectTrigger id="team-managerId" className="w-48">
            <SelectValue placeholder="— بدون —">
              {(value: string | null) => (value ? users.find((u) => u.id === value)?.label ?? value : "— بدون —")}
            </SelectValue>
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
      <Button type="submit" disabled={pending}>
        {pending ? "جاري الحفظ..." : "+ فريق جديد"}
      </Button>
      {state.formError && (
        <p role="alert" className="w-full text-sm text-destructive">
          {state.formError}
        </p>
      )}
    </form>
  );
}
