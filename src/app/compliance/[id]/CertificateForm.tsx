"use client";

import { useActionState } from "react";
import { createCertificate, type CertificateFormState } from "../actions";
import { certificateTypeLabel, certificateStatusLabel } from "@/lib/complianceLabels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form } from "@/components/ui/form";

const initialState: CertificateFormState = {};
const types = Object.keys(certificateTypeLabel);
const statuses = Object.keys(certificateStatusLabel);

export default function CertificateForm({
  complianceCaseId,
  companyId,
  productId,
  suppliers,
  facilities,
}: {
  complianceCaseId: string;
  companyId: string;
  productId: string;
  suppliers: { id: string; legalName: string }[];
  facilities: { id: string; name: string; supplier: { legalName: string } }[];
}) {
  const action = createCertificate.bind(null, complianceCaseId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <Form action={formAction} state={state} className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
      <input type="hidden" name="companyId" value={companyId} />
      <input type="hidden" name="productId" value={productId} />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="certificateType" className="text-xs">
          نوع الشهادة
        </Label>
        <Select name="certificateType" defaultValue={types[0]}>
          <SelectTrigger id="certificateType" className="w-36">
            <SelectValue>{(value: string) => certificateTypeLabel[value] ?? value}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {types.map((t) => (
              <SelectItem key={t} value={t}>
                {certificateTypeLabel[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {suppliers.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cert-supplierId" className="text-xs">
            المورّد
          </Label>
          <Select name="supplierId">
            <SelectTrigger id="cert-supplierId" className="w-36">
              <SelectValue placeholder="—">
                {(value: string) => suppliers.find((s) => s.id === value)?.legalName ?? value}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {suppliers.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.legalName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      {facilities.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cert-facilityId" className="text-xs">
            المنشأة
          </Label>
          <Select name="facilityId">
            <SelectTrigger id="cert-facilityId" className="w-40">
              <SelectValue placeholder="—">
                {(value: string) => {
                  const facility = facilities.find((f) => f.id === value);
                  return facility ? `${facility.name} — ${facility.supplier.legalName}` : value;
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {facilities.map((f) => (
                <SelectItem key={f.id} value={f.id}>
                  {f.name} — {f.supplier.legalName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="certificateNumber" className="text-xs">
          رقم الشهادة *
        </Label>
        <Input id="certificateNumber" name="certificateNumber" className="w-32" />
        {state.errors?.certificateNumber && <span className="text-xs text-destructive">{state.errors.certificateNumber[0]}</span>}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="issuingAuthority" className="text-xs">
          الجهة المُصدرة *
        </Label>
        <Input id="issuingAuthority" name="issuingAuthority" className="w-40" />
        {state.errors?.issuingAuthority && <span className="text-xs text-destructive">{state.errors.issuingAuthority[0]}</span>}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="issueDate" className="text-xs">
          تاريخ الإصدار *
        </Label>
        <Input id="issueDate" name="issueDate" type="date" className="w-40" />
        {state.errors?.issueDate && <span className="text-xs text-destructive">{state.errors.issueDate[0]}</span>}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="expiryDate" className="text-xs">
          تاريخ الانتهاء
        </Label>
        <Input id="expiryDate" name="expiryDate" type="date" className="w-40" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="cert-status" className="text-xs">
          الحالة
        </Label>
        <Select name="status" defaultValue={statuses[0]}>
          <SelectTrigger id="cert-status" className="w-36">
            <SelectValue>{(value: string) => certificateStatusLabel[value] ?? value}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {statuses.map((s) => (
              <SelectItem key={s} value={s}>
                {certificateStatusLabel[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "جاري الإضافة..." : "+ شهادة"}
      </Button>
      {state.formError && <p role="alert" className="w-full text-sm text-destructive">{state.formError}</p>}
    </Form>
  );
}
