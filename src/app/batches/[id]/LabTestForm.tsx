"use client";

import { useActionState } from "react";
import { createLabTest, type LabTestFormState } from "../actions";
import { labTestTypeLabel, labTestPassFailLabel } from "@/lib/procurementLabels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const initialState: LabTestFormState = {};
const testTypes = Object.keys(labTestTypeLabel);
const passFails = Object.keys(labTestPassFailLabel);

export default function LabTestForm({
  batchId,
  inspections,
  supplierSamples,
}: {
  batchId: string;
  inspections: { id: string; stage: string }[];
  supplierSamples: { id: string; productNameAr: string }[];
}) {
  const action = createLabTest.bind(null, batchId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
      {inspections.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="inspectionId" className="text-xs">
            الفحص المرتبط
          </Label>
          <Select name="inspectionId">
            <SelectTrigger id="inspectionId" className="w-36">
              <SelectValue placeholder="—">{(value: string) => inspections.find((i) => i.id === value)?.stage ?? value}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {inspections.map((i) => (
                <SelectItem key={i.id} value={i.id}>
                  {i.stage}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      {supplierSamples.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="supplierSampleId" className="text-xs">
            عينة المورّد المرتبطة
          </Label>
          <Select name="supplierSampleId">
            <SelectTrigger id="supplierSampleId" className="w-36">
              <SelectValue placeholder="—">{(value: string) => supplierSamples.find((s) => s.id === value)?.productNameAr ?? value}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {supplierSamples.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.productNameAr}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="testType" className="text-xs">
          نوع الفحص *
        </Label>
        <Select name="testType" defaultValue={testTypes[0]}>
          <SelectTrigger id="testType" className="w-36">
            <SelectValue>{(value: string) => labTestTypeLabel[value] ?? value}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {testTypes.map((t) => (
              <SelectItem key={t} value={t}>
                {labTestTypeLabel[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="parameter" className="text-xs">
          المؤشر
        </Label>
        <Input id="parameter" name="parameter" className="w-28" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="lt-unit" className="text-xs">
          الوحدة
        </Label>
        <Input id="lt-unit" name="unit" className="w-20" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="minLimit" className="text-xs">
          الحد الأدنى
        </Label>
        <Input id="minLimit" name="minLimit" type="number" step="0.0001" className="w-24" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="maxLimit" className="text-xs">
          الحد الأقصى
        </Label>
        <Input id="maxLimit" name="maxLimit" type="number" step="0.0001" className="w-24" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="actualResult" className="text-xs">
          النتيجة الفعلية
        </Label>
        <Input id="actualResult" name="actualResult" type="number" step="0.0001" className="w-24" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="laboratory" className="text-xs">
          المعمل
        </Label>
        <Input id="laboratory" name="laboratory" className="w-28" />
      </div>
      <div className="flex items-center gap-1.5">
        <Checkbox id="isAccredited" name="isAccredited" />
        <Label htmlFor="isAccredited" className="text-xs font-normal">
          معمل معتمد
        </Label>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="passFail" className="text-xs">
          النتيجة *
        </Label>
        <Select name="passFail" defaultValue={passFails[0]}>
          <SelectTrigger id="passFail" className="w-28">
            <SelectValue>{(value: string) => labTestPassFailLabel[value] ?? value}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {passFails.map((p) => (
              <SelectItem key={p} value={p}>
                {labTestPassFailLabel[p]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? "جاري التسجيل..." : "+ فحص معملي"}
      </Button>
      {state.formError && <p role="alert" className="w-full text-sm text-destructive">{state.formError}</p>}
    </form>
  );
}
