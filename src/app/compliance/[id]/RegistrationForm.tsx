"use client";

import { useActionState } from "react";
import { createRegistration, type RegistrationFormState } from "../actions";
import { registrationTypeLabel } from "@/lib/complianceLabels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const initialState: RegistrationFormState = {};
const types = Object.keys(registrationTypeLabel);

export default function RegistrationForm({
  complianceCaseId,
  productId,
  suppliers,
  facilities,
}: {
  complianceCaseId: string;
  productId: string;
  suppliers: { id: string; legalName: string }[];
  facilities: { id: string; name: string; supplier: { legalName: string } }[];
}) {
  const action = createRegistration.bind(null, complianceCaseId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
      <input type="hidden" name="productId" value={productId} />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="registrationType" className="text-xs">
          نوع التسجيل
        </Label>
        <Select name="registrationType" defaultValue={types[0]}>
          <SelectTrigger id="registrationType" className="w-40">
            <SelectValue>{(value: string) => registrationTypeLabel[value] ?? value}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {types.map((t) => (
              <SelectItem key={t} value={t}>
                {registrationTypeLabel[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {suppliers.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="reg-supplierId" className="text-xs">
            المورّد
          </Label>
          <Select name="supplierId">
            <SelectTrigger id="reg-supplierId" className="w-36">
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
          <Label htmlFor="reg-facilityId" className="text-xs">
            المنشأة
          </Label>
          <Select name="facilityId">
            <SelectTrigger id="reg-facilityId" className="w-40">
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
        <Label htmlFor="country" className="text-xs">
          الدولة *
        </Label>
        <Input id="country" name="country" className="w-32" />
        {state.errors?.country && <span className="text-xs text-destructive">{state.errors.country[0]}</span>}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="authority" className="text-xs">
          الجهة المختصة *
        </Label>
        <Input id="authority" name="authority" className="w-40" />
        {state.errors?.authority && <span className="text-xs text-destructive">{state.errors.authority[0]}</span>}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="registrationNumber" className="text-xs">
          رقم التسجيل
        </Label>
        <Input id="registrationNumber" name="registrationNumber" className="w-32" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="submissionDate" className="text-xs">
          تاريخ التقديم
        </Label>
        <Input id="submissionDate" name="submissionDate" type="date" className="w-40" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="approvalDate" className="text-xs">
          تاريخ الاعتماد
        </Label>
        <Input id="approvalDate" name="approvalDate" type="date" className="w-40" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="reg-expiryDate" className="text-xs">
          تاريخ الانتهاء
        </Label>
        <Input id="reg-expiryDate" name="expiryDate" type="date" className="w-40" />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "جاري الإضافة..." : "+ تسجيل"}
      </Button>
      {state.formError && <p role="alert" className="w-full text-sm text-destructive">{state.formError}</p>}
    </form>
  );
}
