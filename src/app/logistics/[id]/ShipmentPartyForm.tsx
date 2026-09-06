"use client";

import { useActionState } from "react";
import { addShipmentParty, type ShipmentPartyFormState } from "../actions";
import { partyRoleLabel } from "@/lib/logisticsLabels";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const initialState: ShipmentPartyFormState = {};
const roles = Object.keys(partyRoleLabel);

export default function ShipmentPartyForm({
  shipmentId,
  companies,
}: {
  shipmentId: string;
  companies: { id: string; legalName: string }[];
}) {
  const action = addShipmentParty.bind(null, shipmentId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="partyRole" className="text-xs">
          الدور
        </Label>
        <Select name="partyRole" defaultValue={roles[0]}>
          <SelectTrigger id="partyRole" className="w-40">
            <SelectValue>{(value: string) => partyRoleLabel[value] ?? value}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {roles.map((r) => (
              <SelectItem key={r} value={r}>
                {partyRoleLabel[r]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="companyId" className="text-xs">
          الشركة *
        </Label>
        <Select name="companyId">
          <SelectTrigger id="companyId" className="w-56">
            <SelectValue placeholder="اختر شركة">{(value: string) => companies.find((c) => c.id === value)?.legalName ?? value}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {companies.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.legalName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {state.errors?.companyId && <span className="text-xs text-destructive">{state.errors.companyId[0]}</span>}
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "جاري الإضافة..." : "+ طرف"}
      </Button>
      {state.formError && <p role="alert" className="w-full text-sm text-destructive">{state.formError}</p>}
    </form>
  );
}
