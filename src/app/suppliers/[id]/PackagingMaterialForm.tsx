"use client";

import { useActionState } from "react";
import { createPackagingMaterial, type PackagingMaterialFormState } from "../actions";
import { packagingMaterialTypeLabel } from "@/lib/procurementLabels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const initialState: PackagingMaterialFormState = {};
const materialTypes = Object.keys(packagingMaterialTypeLabel);

export default function PackagingMaterialForm({ supplierId }: { supplierId: string }) {
  const action = createPackagingMaterial.bind(null, supplierId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="materialType" className="text-xs">
          نوع المادة *
        </Label>
        <Select name="materialType" defaultValue={materialTypes[0]}>
          <SelectTrigger id="materialType" className="w-32">
            <SelectValue>{(value: string) => packagingMaterialTypeLabel[value] ?? value}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {materialTypes.map((t) => (
              <SelectItem key={t} value={t}>
                {packagingMaterialTypeLabel[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="specification" className="text-xs">
          المواصفة
        </Label>
        <Input id="specification" name="specification" className="w-32" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="dimensions" className="text-xs">
          الأبعاد
        </Label>
        <Input id="dimensions" name="dimensions" className="w-28" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="artworkVersion" className="text-xs">
          إصدار التصميم
        </Label>
        <Input id="artworkVersion" name="artworkVersion" className="w-24" />
      </div>
      <div className="flex items-center gap-1.5 pb-2">
        <Checkbox id="artworkApproved" name="artworkApproved" />
        <Label htmlFor="artworkApproved" className="text-xs">
          التصميم معتمد
        </Label>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="minimumOrder" className="text-xs">
          الحد الأدنى للطلب
        </Label>
        <Input id="minimumOrder" name="minimumOrder" type="number" min="0" step="0.001" className="w-24" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="leadTimeDays" className="text-xs">
          مدة التوريد (يوم)
        </Label>
        <Input id="leadTimeDays" name="leadTimeDays" type="number" min="0" step="1" className="w-20" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="quantityOrdered" className="text-xs">
          الكمية المطلوبة
        </Label>
        <Input id="quantityOrdered" name="quantityOrdered" type="number" min="0" step="0.001" className="w-24" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="quantityReceived" className="text-xs">
          الكمية المستلمة
        </Label>
        <Input id="quantityReceived" name="quantityReceived" type="number" min="0" step="0.001" className="w-24" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="quantityAccepted" className="text-xs">
          الكمية المقبولة
        </Label>
        <Input id="quantityAccepted" name="quantityAccepted" type="number" min="0" step="0.001" className="w-24" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="unitCost" className="text-xs">
          تكلفة الوحدة
        </Label>
        <Input id="unitCost" name="unitCost" type="number" min="0" step="0.0001" className="w-24" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="packaging-currency" className="text-xs">
          العملة
        </Label>
        <Input id="packaging-currency" name="currency" className="w-20" placeholder="USD" />
      </div>
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? "جاري الإضافة..." : "+ مادة تعبئة"}
      </Button>
      {state.formError && <p role="alert" className="w-full text-sm text-destructive">{state.formError}</p>}
    </form>
  );
}
