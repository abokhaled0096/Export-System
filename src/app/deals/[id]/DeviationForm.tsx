"use client";

import { useActionState } from "react";
import { addDealActualDeviation, type DeviationFormState } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form } from "@/components/ui/form";
import { DEVIATION_REASON_LABEL } from "@/lib/dealActual";

const initialState: DeviationFormState = {};
const reasons = Object.keys(DEVIATION_REASON_LABEL);

export default function DeviationForm({ dealId, usedReasons }: { dealId: string; usedReasons: string[] }) {
  const action = addDealActualDeviation.bind(null, dealId);
  const [state, formAction, pending] = useActionState(action, initialState);
  // السبب المسجَّل مرة مابيظهرش تاني — القيد الفريد في القاعدة بيمنعه، والواجهة
  // بتمنع المحاولة أصلًا بدل ما تسيب المستخدم يوصل لرسالة خطأ كان ممكن يتجنبها.
  const available = reasons.filter((r) => !usedReasons.includes(r));

  return (
    <Form action={formAction} state={state} className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="dev-reason" className="text-xs">
          سبب الانحراف *
        </Label>
        <Select name="reason" defaultValue={available[0]}>
          <SelectTrigger id="dev-reason" className="w-44">
            <SelectValue>{(v: string) => DEVIATION_REASON_LABEL[v] ?? v}</SelectValue>
          </SelectTrigger>
          <SelectContent emptyHint="كل الأسباب الـ15 متسجّلة بالفعل على النتيجة دي.">
            {available.map((r) => (
              <SelectItem key={r} value={r}>
                {DEVIATION_REASON_LABEL[r]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="dev-impact" className="text-xs">
          الأثر بالمبلغ
        </Label>
        <Input id="dev-impact" name="impactAmount" type="number" step="0.01" className="w-32" />
        <span className="text-xs text-muted-foreground">سالب = وفّر</span>
      </div>
      <div className="flex flex-1 flex-col gap-1.5">
        <Label htmlFor="dev-note" className="text-xs">
          ملاحظة
        </Label>
        <Input id="dev-note" name="note" />
      </div>
      <Button type="submit" variant="outline" disabled={pending || available.length === 0}>
        {pending ? "جاري الإضافة..." : "+ سبب"}
      </Button>
      {state.formError && <p role="alert" className="w-full text-sm text-destructive">{state.formError}</p>}
    </Form>
  );
}
