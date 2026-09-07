"use client";

import { useActionState } from "react";
import { createOriginProof, type OriginProofFormState } from "../actions";
import { originProofTypeLabel, originProofCumulationTypeLabel } from "@/lib/complianceLabels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const initialState: OriginProofFormState = {};
const proofTypes = Object.keys(originProofTypeLabel);
const cumulationTypes = Object.keys(originProofCumulationTypeLabel);

export default function OriginProofForm({
  complianceCaseId,
  dealId,
  shipments,
}: {
  complianceCaseId: string;
  dealId: string;
  shipments: { id: string; originPort: string; destinationPort: string }[];
}) {
  const action = createOriginProof.bind(null, complianceCaseId, dealId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="proofType" className="text-xs">
            نوع إثبات المنشأ
          </Label>
          <Select name="proofType" defaultValue={proofTypes[0]}>
            <SelectTrigger id="proofType" className="w-44">
              <SelectValue>{(value: string) => originProofTypeLabel[value] ?? value}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {proofTypes.map((t) => (
                <SelectItem key={t} value={t}>
                  {originProofTypeLabel[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {shipments.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="op-shipmentId" className="text-xs">
              الشحنة
            </Label>
            <Select name="shipmentId">
              <SelectTrigger id="op-shipmentId" className="w-40">
                <SelectValue placeholder="—">
                  {(value: string) => {
                    const shipment = shipments.find((s) => s.id === value);
                    return shipment ? `${shipment.originPort} → ${shipment.destinationPort}` : value;
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {shipments.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.originPort} → {s.destinationPort}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cumulationType" className="text-xs">
            نوع التراكم
          </Label>
          <Select name="cumulationType" defaultValue={cumulationTypes[0]}>
            <SelectTrigger id="cumulationType" className="w-32">
              <SelectValue>{(value: string) => originProofCumulationTypeLabel[value] ?? value}</SelectValue>
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
          <Label htmlFor="op-certificateNumber" className="text-xs">
            رقم الشهادة
          </Label>
          <Input id="op-certificateNumber" name="certificateNumber" className="w-32" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="issuedDate" className="text-xs">
            تاريخ الإصدار
          </Label>
          <Input id="issuedDate" name="issuedDate" type="date" className="w-40" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="op-issuingAuthority" className="text-xs">
            الجهة المُصدرة
          </Label>
          <Input id="op-issuingAuthority" name="issuingAuthority" className="w-40" />
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? "جاري الإضافة..." : "+ إثبات منشأ"}
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-1.5">
          <Checkbox id="usesRevisedPemRules" name="usesRevisedPemRules" />
          <Label htmlFor="usesRevisedPemRules" className="text-xs font-normal">
            بيستخدم قواعد PEM المنقّحة
          </Label>
        </div>
        <div className="flex items-center gap-1.5">
          <Checkbox id="revisedRulesWordingVerified" name="revisedRulesWordingVerified" />
          <Label htmlFor="revisedRulesWordingVerified" className="text-xs font-normal">
            تم التحقق من عبارة &quot;revised rules&quot; الإلزامية
          </Label>
        </div>
      </div>
      {state.formError && <p role="alert" className="text-sm text-destructive">{state.formError}</p>}
    </form>
  );
}
