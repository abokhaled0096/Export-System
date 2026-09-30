"use client";

import { useActionState } from "react";
import { createFarm, type FarmFormState } from "../actions";
import { farmRiskLevelLabel } from "@/lib/procurementLabels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form } from "@/components/ui/form";

const initialState: FarmFormState = {};
const riskLevels = Object.keys(farmRiskLevelLabel);

export default function FarmForm({ supplierId }: { supplierId: string }) {
  const action = createFarm.bind(null, supplierId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <Form action={formAction} state={state} className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="farmerName" className="text-xs">
          اسم المزارع
        </Label>
        <Input id="farmerName" name="farmerName" className="w-32" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="location" className="text-xs">
          الموقع
        </Label>
        <Input id="location" name="location" className="w-32" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="areaFeddan" className="text-xs">
          المساحة (فدان)
        </Label>
        <Input id="areaFeddan" name="areaFeddan" type="number" min="0" step="0.01" className="w-24" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="crop" className="text-xs">
          المحصول
        </Label>
        <Input id="crop" name="crop" className="w-28" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="variety" className="text-xs">
          الصنف
        </Label>
        <Input id="variety" name="variety" className="w-28" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="plantingDate" className="text-xs">
          تاريخ الزراعة
        </Label>
        <Input id="plantingDate" name="plantingDate" type="date" className="w-40" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="expectedHarvestStart" className="text-xs">
          بداية الحصاد المتوقعة
        </Label>
        <Input id="expectedHarvestStart" name="expectedHarvestStart" type="date" className="w-40" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="expectedHarvestEnd" className="text-xs">
          نهاية الحصاد المتوقعة
        </Label>
        <Input id="expectedHarvestEnd" name="expectedHarvestEnd" type="date" className="w-40" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="expectedQuantity" className="text-xs">
          الكمية المتوقعة
        </Label>
        <Input id="expectedQuantity" name="expectedQuantity" type="number" min="0" step="0.001" className="w-28" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="riskLevel" className="text-xs">
          درجة الخطورة *
        </Label>
        <Select name="riskLevel" defaultValue={riskLevels[1]}>
          <SelectTrigger id="riskLevel" className="w-28">
            <SelectValue>{(value: string) => farmRiskLevelLabel[value] ?? value}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {riskLevels.map((r) => (
              <SelectItem key={r} value={r}>
                {farmRiskLevelLabel[r]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? "جاري الإضافة..." : "+ مزرعة"}
      </Button>
      {state.formError && <p role="alert" className="w-full text-sm text-destructive">{state.formError}</p>}
    </Form>
  );
}
