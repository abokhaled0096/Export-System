"use client";

import { useActionState, useState } from "react";
import { createLabTest, type LabTestFormState } from "../actions";
import { labTestTypeLabel, labTestPassFailLabel } from "@/lib/procurementLabels";
import { labTestConflict, labTestConflictHint } from "@/lib/labTestVerdict";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form } from "@/components/ui/form";

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
  // الحدود/النتيجة/الحُكم متحكَّم فيهم علشان التناقض يظهر **وقت الإدخال** مش بعد الحفظ —
  // ساعتها المستخدم لسه بيبص على القيم وقادر يصحّح. راجع src/lib/labTestVerdict.ts.
  const [limits, setLimits] = useState({ minLimit: "", maxLimit: "", actualResult: "", passFail: passFails[0] });
  const conflict = labTestConflict(limits);

  return (
    <Form action={formAction} state={state} className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
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
        <Input
          id="minLimit"
          name="minLimit"
          type="number"
          step="0.0001"
          className="w-24"
          value={limits.minLimit}
          onChange={(e) => setLimits((p) => ({ ...p, minLimit: e.target.value }))}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="maxLimit" className="text-xs">
          الحد الأقصى
        </Label>
        <Input
          id="maxLimit"
          name="maxLimit"
          type="number"
          step="0.0001"
          className="w-24"
          value={limits.maxLimit}
          onChange={(e) => setLimits((p) => ({ ...p, maxLimit: e.target.value }))}
        />
        {state.errors?.maxLimit && <p className="text-xs text-destructive">{state.errors.maxLimit[0]}</p>}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="actualResult" className="text-xs">
          النتيجة الفعلية
        </Label>
        <Input
          id="actualResult"
          name="actualResult"
          type="number"
          step="0.0001"
          className="w-24"
          value={limits.actualResult}
          onChange={(e) => setLimits((p) => ({ ...p, actualResult: e.target.value }))}
        />
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
        <Select name="passFail" value={limits.passFail} onValueChange={(v) => setLimits((p) => ({ ...p, passFail: String(v) }))}>
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
      {conflict && (
        <p role="alert" className="w-full rounded-lg border border-rose-300 bg-rose-50 p-2.5 text-sm text-rose-800">
          {labTestConflictHint[conflict]}
        </p>
      )}
      {state.formError && <p role="alert" className="w-full text-sm text-destructive">{state.formError}</p>}
    </Form>
  );
}
