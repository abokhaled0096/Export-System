"use client";

import { useActionState } from "react";
import { createCommissionEntry, type CommissionEntryFormState } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import CurrencySelect from "@/components/CurrencySelect";

const initialState: CommissionEntryFormState = {};

export default function CommissionEntryForm({
  dealId,
  plans,
  users,
  salesOrders,
}: {
  dealId: string;
  plans: { id: string; name: string }[];
  users: { id: string; fullName: string }[];
  salesOrders: { id: string; soNumber: string }[];
}) {
  const action = createCommissionEntry.bind(null, dealId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="planId" className="text-xs">
          خطة العمولة *
        </Label>
        <Select name="planId">
          <SelectTrigger id="planId" className="w-40">
            <SelectValue placeholder="اختر خطة">{(value: string) => plans.find((p) => p.id === value)?.name ?? value}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {plans.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {state.errors?.planId && <span className="text-xs text-destructive">{state.errors.planId[0]}</span>}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ce-userId" className="text-xs">
          المستخدم *
        </Label>
        <Select name="userId">
          <SelectTrigger id="ce-userId" className="w-36">
            <SelectValue placeholder="اختر مستخدم">{(value: string) => users.find((u) => u.id === value)?.fullName ?? value}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {users.map((u) => (
              <SelectItem key={u.id} value={u.id}>
                {u.fullName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {state.errors?.userId && <span className="text-xs text-destructive">{state.errors.userId[0]}</span>}
      </div>
      {salesOrders.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="salesOrderId" className="text-xs">
            أمر البيع
          </Label>
          <Select name="salesOrderId">
            <SelectTrigger id="salesOrderId" className="w-32">
              <SelectValue placeholder="—">{(value: string) => salesOrders.find((s) => s.id === value)?.soNumber ?? value}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {salesOrders.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.soNumber}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="amount" className="text-xs">
          المبلغ *
        </Label>
        <Input id="amount" name="amount" type="number" min="0" step="0.01" className="w-28" />
        {state.errors?.amount && <span className="text-xs text-destructive">{state.errors.amount[0]}</span>}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ce-currency" className="text-xs">
          العملة
        </Label>
        <CurrencySelect id="ce-currency" name="currency" className="w-20" />
      </div>
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? "جاري التسجيل..." : "+ عمولة"}
      </Button>
      <p className="w-full text-xs text-muted-foreground">
        العمولة بتتسجّل "مستحقة" — الاعتماد والسداد بيحصلوا من الجدول تحت، مش وقت الإنشاء.
      </p>
      {state.formError && <p role="alert" className="w-full text-sm text-destructive">{state.formError}</p>}
    </form>
  );
}
