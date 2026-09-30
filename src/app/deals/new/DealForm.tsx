"use client";

import { useActionState } from "react";
import { createDeal, type DealFormState } from "../actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form } from "@/components/ui/form";

const initialState: DealFormState = {};

const objectives = [
  { value: "MaximizeProfit", label: "أقصى ربح ممكن" },
  { value: "NewMarketEntry", label: "دخول سوق جديد" },
  { value: "WinCustomer", label: "كسب عميل جديد" },
  { value: "ProtectAccount", label: "الحفاظ على عميل حالي" },
  { value: "ClearInventory", label: "تصريف مخزون" },
  { value: "TestMarket", label: "اختبار سوق" },
];

export default function DealForm({
  opportunities,
  defaultOpportunityId,
}: {
  opportunities: { id: string; label: string }[];
  defaultOpportunityId?: string;
}) {
  const [state, formAction, pending] = useActionState(createDeal, initialState);

  return (
    <Form action={formAction} state={state} className="flex max-w-xl flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="opportunityId">الفرصة *</Label>
        <Select name="opportunityId" defaultValue={defaultOpportunityId}>
          <SelectTrigger id="opportunityId" className="w-full">
            {/* تمرير children كدالة بيلغي placeholder تلقائيًا (سلوك base-ui)، فلازم نرجّعه يدويًا لما value فاضية */}
            <SelectValue>
              {(value: string | null) =>
                value ? (opportunities.find((o) => o.id === value)?.label ?? value) : "اختر فرصة"
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {opportunities.map((o) => (
              <SelectItem key={o.id} value={o.id}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {state.errors?.opportunityId && (
          <span className="text-xs text-destructive">{state.errors.opportunityId[0]}</span>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="dealObjective">هدف الصفقة *</Label>
        <Select name="dealObjective" defaultValue={objectives[0].value}>
          <SelectTrigger id="dealObjective" className="w-full">
            <SelectValue>
              {(value: string) => objectives.find((o) => o.value === value)?.label ?? value}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {objectives.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {state.errors?.dealObjective && (
          <span className="text-xs text-destructive">{state.errors.dealObjective[0]}</span>
        )}
      </div>

      {state.formError && (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.formError}</p>
      )}

      <Button type="submit" disabled={pending} className="w-fit">
        {pending ? "جاري الإنشاء..." : "إنشاء الصفقة"}
      </Button>
    </Form>
  );
}
