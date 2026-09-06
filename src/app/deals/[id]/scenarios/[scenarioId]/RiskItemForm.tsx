"use client";

import { useActionState } from "react";
import { createRiskItem, type RiskItemFormState } from "../../../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const initialState: RiskItemFormState = {};

const riskTypes = [
  { value: "FX", label: "سعر صرف" },
  { value: "Freight", label: "شحن" },
  { value: "Supplier", label: "مورد" },
  { value: "Quality", label: "جودة" },
  { value: "Credit", label: "ائتمان/تحصيل" },
  { value: "Compliance", label: "امتثال" },
  { value: "Weather", label: "طقس" },
  { value: "Political", label: "سياسي" },
];

export default function RiskItemForm({ scenarioId }: { scenarioId: string }) {
  const action = createRiskItem.bind(null, scenarioId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ri-riskType" className="text-xs">
          نوع المخاطرة
        </Label>
        <Select name="riskType" defaultValue={riskTypes[0].value}>
          <SelectTrigger id="ri-riskType">
            <SelectValue>
              {(value: string) => riskTypes.find((r) => r.value === value)?.label ?? value}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {riskTypes.map((r) => (
              <SelectItem key={r.value} value={r.value}>
                {r.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ri-probability" className="text-xs">
          الاحتمالية (0-1) *
        </Label>
        <Input id="ri-probability" name="probability" type="number" step="0.01" min="0" max="1" className="w-24" />
        {state.errors?.probability && (
          <span className="text-xs text-destructive">{state.errors.probability[0]}</span>
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ri-financialImpact" className="text-xs">
          الأثر المالي *
        </Label>
        <Input id="ri-financialImpact" name="financialImpact" type="number" step="0.01" className="w-32" />
        {state.errors?.financialImpact && (
          <span className="text-xs text-destructive">{state.errors.financialImpact[0]}</span>
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ri-mitigation" className="text-xs">
          التخفيف
        </Label>
        <Input id="ri-mitigation" name="mitigation" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ri-residualRisk" className="text-xs">
          المخاطرة المتبقية (بعد التخفيف)
        </Label>
        <Input id="ri-residualRisk" name="residualRisk" type="number" step="0.01" min="0" className="w-32" />
        {state.errors?.residualRisk && (
          <span className="text-xs text-destructive">{state.errors.residualRisk[0]}</span>
        )}
      </div>
      <Button type="submit" className="bg-amber-600 text-white hover:bg-amber-700" disabled={pending}>
        {pending ? "جاري الإضافة..." : "+ إضافة مخاطرة"}
      </Button>
      {state.formError && <p role="alert" className="w-full text-sm text-destructive">{state.formError}</p>}
    </form>
  );
}
