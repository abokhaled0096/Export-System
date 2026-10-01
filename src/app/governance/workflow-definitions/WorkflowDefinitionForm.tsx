"use client";

import { useActionState } from "react";
import { createWorkflowDefinitionAction, type WorkflowDefinitionFormState } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form } from "@/components/ui/form";
import { WORKFLOW_ENFORCED_ENTITY_TYPES } from "@/lib/workflow";

const initialState: WorkflowDefinitionFormState = {};

const NO_POLICY = "__none__";

export type ApprovalPolicyOption = { id: string; subjectType: string };

export default function WorkflowDefinitionForm({ approvalPolicies }: { approvalPolicies: ApprovalPolicyOption[] }) {
  const [state, formAction, pending] = useActionState(createWorkflowDefinitionAction, initialState);

  return (
    <Form action={formAction} state={state} className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="wd-entity" className="text-xs">
          الكيان *
        </Label>
        <Input id="wd-entity" name="entityType" placeholder="Opportunity" className="w-36" />
        {state.errors?.entityType && <span className="text-xs text-destructive">{state.errors.entityType[0]}</span>}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="wd-from" className="text-xs">
          من مرحلة *
        </Label>
        <Input id="wd-from" name="fromStage" placeholder="NewLead" className="w-32" />
        {state.errors?.fromStage && <span className="text-xs text-destructive">{state.errors.fromStage[0]}</span>}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="wd-to" className="text-xs">
          لـمرحلة *
        </Label>
        <Input id="wd-to" name="toStage" placeholder="Contacted" className="w-32" />
        {state.errors?.toStage && <span className="text-xs text-destructive">{state.errors.toStage[0]}</span>}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="wd-policy" className="text-xs">
          سياسة موافقة مطلوبة (اختياري)
        </Label>
        <Select name="requiredApprovalPolicyId" defaultValue={NO_POLICY}>
          <SelectTrigger id="wd-policy" className="w-48">
            <SelectValue>
              {(value: string) => (value === NO_POLICY ? "بلا موافقة" : approvalPolicies.find((p) => p.id === value)?.subjectType ?? "—")}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_POLICY}>بلا موافقة</SelectItem>
            {approvalPolicies.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.subjectType}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "جاري الإضافة..." : "+ انتقال مسموح"}
      </Button>
      <p className="w-full text-xs text-muted-foreground">
        {/* ⚠️ القايمة بتتقرا من ثابت محروس باختبار (WORKFLOW_ENFORCED_ENTITY_TYPES) مش
            مكتوبة بالإيد — قبل كده كانت «Opportunity وCAPA حاليًا» وهي اتأخرت على الكود
            لحد ما بقوا ١١ كيان. */}
        الانتقال مش موجود هنا = مرفوض تلقائيًا وقت التنفيذ، للكيانات المربوطة بمحرك الانتقالات:{" "}
        <span className="font-mono">{WORKFLOW_ENFORCED_ENTITY_TYPES.join("، ")}</span>. أي كيان تاني الجدول ده
        بالنسبة له تسجيل مرجعي بس.
      </p>
      {state.formError && (
        <p role="alert" className="w-full text-sm text-destructive">
          {state.formError}
        </p>
      )}
    </Form>
  );
}
