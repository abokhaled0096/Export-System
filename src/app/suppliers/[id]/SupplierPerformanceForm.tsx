"use client";

import { useActionState } from "react";
import { createSupplierPerformance, type SupplierPerformanceFormState } from "../actions";
import { supplierPerformanceClassificationLabel } from "@/lib/procurementLabels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const initialState: SupplierPerformanceFormState = {};
const classifications = Object.keys(supplierPerformanceClassificationLabel);

export default function SupplierPerformanceForm({ supplierId }: { supplierId: string }) {
  const action = createSupplierPerformance.bind(null, supplierId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="periodStart" className="text-xs">
          بداية الفترة *
        </Label>
        <Input id="periodStart" name="periodStart" type="date" className="w-40" />
        {state.errors?.periodStart && <span className="text-xs text-destructive">{state.errors.periodStart[0]}</span>}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="periodEnd" className="text-xs">
          نهاية الفترة *
        </Label>
        <Input id="periodEnd" name="periodEnd" type="date" className="w-40" />
        {state.errors?.periodEnd && <span className="text-xs text-destructive">{state.errors.periodEnd[0]}</span>}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="qualityPassRate" className="text-xs">
          نسبة اجتياز الجودة %
        </Label>
        <Input id="qualityPassRate" name="qualityPassRate" type="number" min="0" max="100" step="0.01" className="w-24" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="rejectionRate" className="text-xs">
          نسبة الرفض %
        </Label>
        <Input id="rejectionRate" name="rejectionRate" type="number" min="0" max="100" step="0.01" className="w-24" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="onTimeDeliveryRate" className="text-xs">
          الالتزام بالمواعيد %
        </Label>
        <Input id="onTimeDeliveryRate" name="onTimeDeliveryRate" type="number" min="0" max="100" step="0.01" className="w-24" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="yieldAccuracy" className="text-xs">
          دقة الاستخلاص %
        </Label>
        <Input id="yieldAccuracy" name="yieldAccuracy" type="number" min="0" max="100" step="0.01" className="w-24" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="priceAccuracy" className="text-xs">
          دقة السعر %
        </Label>
        <Input id="priceAccuracy" name="priceAccuracy" type="number" min="0" max="100" step="0.01" className="w-24" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="overallScore" className="text-xs">
          الدرجة الإجمالية
        </Label>
        <Input id="overallScore" name="overallScore" type="number" min="0" max="100" step="0.01" className="w-24" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="classification" className="text-xs">
          التصنيف
        </Label>
        <Select name="classification">
          <SelectTrigger id="classification" className="w-36">
            <SelectValue placeholder="بلا تصنيف">{(value: string) => supplierPerformanceClassificationLabel[value] ?? value}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {classifications.map((c) => (
              <SelectItem key={c} value={c}>
                {supplierPerformanceClassificationLabel[c]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? "جاري التسجيل..." : "+ تقييم أداء"}
      </Button>
      {state.formError && <p role="alert" className="w-full text-sm text-destructive">{state.formError}</p>}
    </form>
  );
}
