"use client";

import { useActionState } from "react";
import { createSupplierAudit, type SupplierAuditFormState } from "../actions";
import { supplierAuditDecisionLabel } from "@/lib/procurementLabels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form } from "@/components/ui/form";

const initialState: SupplierAuditFormState = {};
const decisions = Object.keys(supplierAuditDecisionLabel);

export default function SupplierAuditForm({ supplierId, facilities }: { supplierId: string; facilities: { id: string; name: string }[] }) {
  const action = createSupplierAudit.bind(null, supplierId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <Form action={formAction} state={state} className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
      {facilities.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="audit-facilityId" className="text-xs">
            المنشأة
          </Label>
          <Select name="facilityId">
            <SelectTrigger id="audit-facilityId" className="w-40">
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
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="auditDate" className="text-xs">
          تاريخ التدقيق
        </Label>
        <Input id="auditDate" name="auditDate" type="date" className="w-40" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="auditor" className="text-xs">
          المدقّق
        </Label>
        <Input id="auditor" name="auditor" className="w-32" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="totalScore" className="text-xs">
          الدرجة الإجمالية
        </Label>
        <Input id="totalScore" name="totalScore" type="number" min="0" max="100" step="0.01" className="w-24" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="criticalFindings" className="text-xs">
          ملاحظات حرجة
        </Label>
        <Input id="criticalFindings" name="criticalFindings" type="number" min="0" step="1" className="w-20" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="majorFindings" className="text-xs">
          ملاحظات رئيسية
        </Label>
        <Input id="majorFindings" name="majorFindings" type="number" min="0" step="1" className="w-20" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="minorFindings" className="text-xs">
          ملاحظات بسيطة
        </Label>
        <Input id="minorFindings" name="minorFindings" type="number" min="0" step="1" className="w-20" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="decision" className="text-xs">
          القرار *
        </Label>
        <Select name="decision" defaultValue={decisions[0]}>
          <SelectTrigger id="decision" className="w-36">
            <SelectValue>{(value: string) => supplierAuditDecisionLabel[value] ?? value}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {decisions.map((d) => (
              <SelectItem key={d} value={d}>
                {supplierAuditDecisionLabel[d]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="followUpDate" className="text-xs">
          تاريخ المتابعة
        </Label>
        <Input id="followUpDate" name="followUpDate" type="date" className="w-40" />
      </div>
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? "جاري التسجيل..." : "+ تدقيق"}
      </Button>
      {state.formError && <p role="alert" className="w-full text-sm text-destructive">{state.formError}</p>}
    </Form>
  );
}
