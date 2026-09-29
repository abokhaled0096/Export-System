"use client";

import { useActionState } from "react";
import { createLCRequirement, type LCRequirementFormState } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import CurrencySelect from "@/components/CurrencySelect";

const initialState: LCRequirementFormState = {};

export default function LCRequirementForm({ complianceCaseId, dealId }: { complianceCaseId: string; dealId: string }) {
  const action = createLCRequirement.bind(null, complianceCaseId, dealId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="lcNumber" className="text-xs">
            رقم خطاب الاعتماد *
          </Label>
          <Input id="lcNumber" name="lcNumber" className="w-32" />
          {state.errors?.lcNumber && <span className="text-xs text-destructive">{state.errors.lcNumber[0]}</span>}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="issuingBank" className="text-xs">
            البنك المُصدر *
          </Label>
          <Input id="issuingBank" name="issuingBank" className="w-40" />
          {state.errors?.issuingBank && <span className="text-xs text-destructive">{state.errors.issuingBank[0]}</span>}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="amount" className="text-xs">
            المبلغ *
          </Label>
          <Input id="amount" name="amount" type="number" step="0.01" min="0" className="w-32" />
          {state.errors?.amount && <span className="text-xs text-destructive">{state.errors.amount[0]}</span>}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="lc-currency" className="text-xs">
            العملة *
          </Label>
          <CurrencySelect id="lc-currency" name="currency" className="w-20" />
          {state.errors?.currency && <span className="text-xs text-destructive">{state.errors.currency[0]}</span>}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="expiryDate" className="text-xs">
            تاريخ الانتهاء *
          </Label>
          <Input id="expiryDate" name="expiryDate" type="date" className="w-40" />
          {state.errors?.expiryDate && <span className="text-xs text-destructive">{state.errors.expiryDate[0]}</span>}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="latestShipmentDate" className="text-xs">
            آخر موعد شحن
          </Label>
          <Input id="latestShipmentDate" name="latestShipmentDate" type="date" className="w-40" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="presentationPeriodDays" className="text-xs">
            مهلة تقديم المستندات (أيام)
          </Label>
          <Input id="presentationPeriodDays" name="presentationPeriodDays" type="number" min="0" className="w-24" />
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? "جاري الإضافة..." : "+ متطلبات LC"}
        </Button>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="requiredDocuments" className="text-xs">
          المستندات المطلوبة (مفصولة بفاصلة)
        </Label>
        <Input id="requiredDocuments" name="requiredDocuments" className="w-full" placeholder="Bill of Lading, Certificate of Origin, Packing List" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="requiredWording" className="text-xs">
          الصياغة الإلزامية
        </Label>
        <Input id="requiredWording" name="requiredWording" className="w-full" />
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-1.5">
          <Checkbox id="partialShipmentAllowed" name="partialShipmentAllowed" />
          <Label htmlFor="partialShipmentAllowed" className="text-xs font-normal">
            شحن جزئي مسموح
          </Label>
        </div>
        <div className="flex items-center gap-1.5">
          <Checkbox id="transshipmentAllowed" name="transshipmentAllowed" />
          <Label htmlFor="transshipmentAllowed" className="text-xs font-normal">
            الشحن العابر مسموح
          </Label>
        </div>
      </div>
      {state.formError && <p role="alert" className="text-sm text-destructive">{state.formError}</p>}
    </form>
  );
}
