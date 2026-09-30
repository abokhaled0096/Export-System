"use client";

import { useActionState } from "react";
import { createProductionPlan, type ProductionPlanFormState } from "../actions";
import { productionProcessLabel } from "@/lib/procurementLabels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form } from "@/components/ui/form";

const initialState: ProductionPlanFormState = {};
const processes = Object.keys(productionProcessLabel);

export default function ProductionPlanForm({
  purchaseOrderId,
  facilities,
}: {
  purchaseOrderId: string;
  facilities: { id: string; name: string }[];
}) {
  const action = createProductionPlan.bind(null, purchaseOrderId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <Form action={formAction} state={state} className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="pp-facilityId" className="text-xs">
          المنشأة *
        </Label>
        <Select name="facilityId">
          <SelectTrigger id="pp-facilityId" className="w-40">
            <SelectValue placeholder="اختر منشأة">{(value: string) => facilities.find((f) => f.id === value)?.name ?? value}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {facilities.map((f) => (
              <SelectItem key={f.id} value={f.id}>
                {f.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {state.errors?.facilityId && <span className="text-xs text-destructive">{state.errors.facilityId[0]}</span>}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="process" className="text-xs">
          المعالجة *
        </Label>
        <Select name="process" defaultValue={processes[0]}>
          <SelectTrigger id="process" className="w-32">
            <SelectValue>{(value: string) => productionProcessLabel[value] ?? value}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {processes.map((p) => (
              <SelectItem key={p} value={p}>
                {productionProcessLabel[p]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="rawQuantity" className="text-xs">
          الكمية الخام
        </Label>
        <Input id="rawQuantity" name="rawQuantity" type="number" min="0" step="0.001" className="w-24" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="targetYield" className="text-xs">
          نسبة الاستخلاص المستهدفة
        </Label>
        <Input id="targetYield" name="targetYield" type="number" min="0" max="1" step="0.01" className="w-24" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="pp-startDate" className="text-xs">
          تاريخ البداية
        </Label>
        <Input id="pp-startDate" name="startDate" type="date" className="w-40" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="pp-endDate" className="text-xs">
          تاريخ النهاية
        </Label>
        <Input id="pp-endDate" name="endDate" type="date" className="w-40" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="cargoReadyDate" className="text-xs">
          جاهزية الشحن
        </Label>
        <Input id="cargoReadyDate" name="cargoReadyDate" type="date" className="w-40" />
      </div>
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? "جاري الإضافة..." : "+ خطة إنتاج"}
      </Button>
      {state.formError && <p role="alert" className="w-full text-sm text-destructive">{state.formError}</p>}
    </Form>
  );
}
