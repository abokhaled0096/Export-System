"use client";

import { useActionState, useState } from "react";
import { updateOriginProofAction, type OriginProofUpdateFormState } from "../actions";
import { originProofCumulationTypeLabel, originProofStatusLabel } from "@/lib/complianceLabels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const initialState: OriginProofUpdateFormState = {};
const cumulationTypes = Object.keys(originProofCumulationTypeLabel);

export type EditableOriginProof = {
  id: string;
  usesRevisedPemRules: boolean;
  revisedRulesWordingVerified: boolean;
  cumulationType: string | null;
  certificateNumber: string | null;
  issuedDate: string | null;
  issuingAuthority: string | null;
  status: string;
};

export default function EditOriginProofForm({
  complianceCaseId,
  proof,
  allowedNextStatuses,
}: {
  complianceCaseId: string;
  proof: EditableOriginProof;
  allowedNextStatuses: string[];
}) {
  const action = updateOriginProofAction.bind(null, complianceCaseId, proof.id);
  const [state, formAction, pending] = useActionState(action, initialState);
  const [open, setOpen] = useState(false);
  // الحالة الحالية + الانتقالات المسموحة بس (جدول WorkflowDefinition، وحدة 9).
  const statuses = [proof.status, ...allowedNextStatuses.filter((s) => s !== proof.status)];

  if (!open) {
    return (
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        تعديل
      </Button>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-xl border border-primary/30 bg-primary/5 p-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`ecn-${proof.id}`} className="text-xs">
            رقم الشهادة
          </Label>
          <Input id={`ecn-${proof.id}`} name="certificateNumber" defaultValue={proof.certificateNumber ?? ""} className="w-32" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`eid-${proof.id}`} className="text-xs">
            تاريخ الإصدار
          </Label>
          <Input id={`eid-${proof.id}`} name="issuedDate" type="date" defaultValue={proof.issuedDate ?? ""} className="w-40" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`eia-${proof.id}`} className="text-xs">
            الجهة المُصدرة
          </Label>
          <Input id={`eia-${proof.id}`} name="issuingAuthority" defaultValue={proof.issuingAuthority ?? ""} className="w-40" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`ect-${proof.id}`} className="text-xs">
            نوع التراكم
          </Label>
          <Select name="cumulationType" defaultValue={proof.cumulationType ?? undefined}>
            <SelectTrigger id={`ect-${proof.id}`} className="w-32">
              <SelectValue placeholder="—">{(value: string) => originProofCumulationTypeLabel[value] ?? value}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {cumulationTypes.map((c) => (
                <SelectItem key={c} value={c}>
                  {originProofCumulationTypeLabel[c]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`est-${proof.id}`} className="text-xs">
            الحالة
          </Label>
          <Select name="status" defaultValue={proof.status}>
            <SelectTrigger id={`est-${proof.id}`} className="w-36">
              <SelectValue>{(value: string) => originProofStatusLabel[value] ?? value}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {statuses.map((s) => (
                <SelectItem key={s} value={s}>
                  {originProofStatusLabel[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {proof.usesRevisedPemRules && (
        <div className="flex items-center gap-1.5">
          <Checkbox id={`erv-${proof.id}`} name="revisedRulesWordingVerified" defaultChecked={proof.revisedRulesWordingVerified} />
          <Label htmlFor={`erv-${proof.id}`} className="text-xs font-normal">
            تم التحقق من عبارة &quot;revised rules&quot; الإلزامية — لازمة عشان بوابات الشحن المعلَّمة تعدّي
          </Label>
        </div>
      )}

      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "جاري الحفظ..." : "حفظ"}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => setOpen(false)}>
          إلغاء
        </Button>
      </div>
      {state.formError && (
        <p role="alert" className="text-sm text-destructive">
          {state.formError}
        </p>
      )}
    </form>
  );
}
