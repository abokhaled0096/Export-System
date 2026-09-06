"use client";

import { useActionState } from "react";
import { createSalesTarget, type SalesTargetFormState } from "./actions";
import { salesTargetTypeLabel } from "@/lib/salesTargetLabels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const initialState: SalesTargetFormState = {};
const targetTypes = Object.keys(salesTargetTypeLabel);

export default function SalesTargetForm({
  users,
  teams,
}: {
  users: { id: string; fullName: string }[];
  teams: { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState(createSalesTarget, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
      {users.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="st-userId" className="text-xs">
            المستخدم
          </Label>
          <Select name="userId">
            <SelectTrigger id="st-userId" className="w-36">
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
          <Label htmlFor="st-teamId" className="text-xs">
            الفريق
          </Label>
          <Select name="teamId">
            <SelectTrigger id="st-teamId" className="w-36">
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
        <Label htmlFor="period" className="text-xs">
          الفترة *
        </Label>
        <Input id="period" name="period" placeholder="2026-Q4" className="w-28" />
        {state.errors?.period && <span className="text-xs text-destructive">{state.errors.period[0]}</span>}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="targetType" className="text-xs">
          النوع
        </Label>
        <Select name="targetType" defaultValue={targetTypes[0]}>
          <SelectTrigger id="targetType" className="w-32">
            <SelectValue>{(value: string) => salesTargetTypeLabel[value] ?? value}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {targetTypes.map((t) => (
              <SelectItem key={t} value={t}>
                {salesTargetTypeLabel[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="targetValue" className="text-xs">
          القيمة المستهدفة *
        </Label>
        <Input id="targetValue" name="targetValue" type="number" min="0" step="0.01" className="w-28" />
        {state.errors?.targetValue && <span className="text-xs text-destructive">{state.errors.targetValue[0]}</span>}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="st-currency" className="text-xs">
          العملة
        </Label>
        <Input id="st-currency" name="currency" placeholder="USD" className="w-20" />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "جاري الإضافة..." : "+ هدف"}
      </Button>
      {state.formError && <p role="alert" className="w-full text-sm text-destructive">{state.formError}</p>}
    </form>
  );
}
