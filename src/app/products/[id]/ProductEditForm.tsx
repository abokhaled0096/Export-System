"use client";

import { useActionState } from "react";
import { updateProduct, type UpdateProductFormState } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form } from "@/components/ui/form";

const initialState: UpdateProductFormState = {};
const monthLabel = ["", "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
const statusLabel: Record<string, string> = { Draft: "مسودة", Verified: "موثّق", NeedsReview: "يحتاج مراجعة" };

export default function ProductEditForm({
  productId,
  status,
  allowedNextStatuses,
  availableMonths,
  storageTempC,
}: {
  productId: string;
  status: string;
  allowedNextStatuses: string[];
  availableMonths: number[];
  storageTempC: number | null;
}) {
  const updateProductWithId = updateProduct.bind(null, productId);
  const [state, formAction, pending] = useActionState(updateProductWithId, initialState);
  // الحالة الحالية + الانتقالات المسموحة بس (جدول WorkflowDefinition، وحدة 9) — بدل عرض
  // الحالات التلاتة دايمًا زي الأول، عشان محدش يختار انتقال هيترفض من السيرفر أصلًا.
  const selectableStatuses = [status, ...allowedNextStatuses.filter((s) => s !== status)];

  return (
    <Form action={formAction} state={state} className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="status">حالة التوثيق</Label>
          <Select name="status" defaultValue={status}>
            <SelectTrigger id="status" className="w-full">
              <SelectValue placeholder="اختر حالة">
                {(value: string | null) => (value ? statusLabel[value] : "اختر حالة")}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {selectableStatuses.map((value) => (
                <SelectItem key={value} value={value}>
                  {statusLabel[value] ?? value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="storageTempC">درجة حرارة التخزين (°C)</Label>
          <Input id="storageTempC" name="storageTempC" type="number" defaultValue={storageTempC ?? ""} />
          {state.errors?.storageTempC && <span className="text-xs text-destructive">{state.errors.storageTempC[0]}</span>}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label className="text-xs">شهور توفّر المنتج عندنا (موسميًا)</Label>
        <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5">
          {monthLabel.slice(1).map((label, i) => (
            <label key={i} className="flex items-center gap-1 text-xs">
              <input type="checkbox" name="availableMonths" value={i + 1} defaultChecked={availableMonths.includes(i + 1)} className="size-3.5" />
              {label}
            </label>
          ))}
        </div>
        {state.errors?.availableMonths && <span className="text-xs text-destructive">{state.errors.availableMonths[0]}</span>}
      </div>

      {state.formError && (
        <p role="alert" className="text-sm text-destructive">
          {state.formError}
        </p>
      )}

      <Button type="submit" disabled={pending} className="w-fit">
        {pending ? "جاري الحفظ..." : "حفظ التعديلات"}
      </Button>
    </Form>
  );
}
