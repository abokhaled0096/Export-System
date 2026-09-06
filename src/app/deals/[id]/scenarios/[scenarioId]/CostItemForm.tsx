"use client";

import { useActionState, useState } from "react";
import { createCostItem, type CostItemFormState } from "../../../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const initialState: CostItemFormState = {};

const categories = [
  { value: "Product", label: "المنتج" },
  { value: "Processing", label: "تصنيع/معالجة" },
  { value: "Packaging", label: "تعبئة" },
  { value: "Quality", label: "جودة" },
  { value: "ExportLogistics", label: "لوجستيات تصدير" },
  { value: "InternationalFreight", label: "شحن دولي" },
  { value: "DestinationCharges", label: "رسوم الوجهة" },
  { value: "SellingAdmin", label: "إداري/بيعي" },
  { value: "Finance", label: "تمويل" },
  { value: "RiskReserve", label: "احتياطي مخاطر" },
];

const confidenceLevels = [
  { value: "Contract100", label: "عقد موقّع (100%)" },
  { value: "OfficialQuote90", label: "عرض سعر رسمي (90%)" },
  { value: "ExpiringQuote75", label: "عرض سعر منتهي قريبًا (75%)" },
  { value: "HistoricalAvg60", label: "متوسط تاريخي (60%)" },
  { value: "InternalEstimate40", label: "تقدير داخلي (40%)" },
  { value: "Assumption20", label: "افتراض (20%)" },
];

export default function CostItemForm({
  scenarioId,
  scenarioCurrency,
}: {
  scenarioId: string;
  scenarioCurrency: string;
}) {
  const action = createCostItem.bind(null, scenarioId);
  const [state, formAction, pending] = useActionState(action, initialState);
  const [currency, setCurrency] = useState(scenarioCurrency);
  const needsFxRate = currency.trim().toUpperCase() !== scenarioCurrency;

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ci-category" className="text-xs">
          البند
        </Label>
        <Select name="category" defaultValue={categories[0].value}>
          <SelectTrigger id="ci-category">
            <SelectValue>
              {(value: string) => categories.find((c) => c.value === value)?.label ?? value}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {categories.map((c) => (
              <SelectItem key={c.value} value={c.value}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ci-subcategory" className="text-xs">
          تفصيل
        </Label>
        <Input id="ci-subcategory" name="subcategory" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ci-amount" className="text-xs">
          المبلغ *
        </Label>
        <Input id="ci-amount" name="amount" type="number" step="0.01" className="w-32" />
        {state.errors?.amount && <span className="text-xs text-destructive">{state.errors.amount[0]}</span>}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ci-currency" className="text-xs">
          العملة *
        </Label>
        <Input
          id="ci-currency"
          name="currency"
          className="w-20 uppercase"
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
        />
        {state.errors?.currency && <span className="text-xs text-destructive">{state.errors.currency[0]}</span>}
      </div>
      {needsFxRate && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ci-fxRate" className="text-xs">
            سعر الصرف * (1 {currency.trim().toUpperCase() || "؟"} = ؟ {scenarioCurrency})
          </Label>
          <Input id="ci-fxRate" name="fxRate" type="number" step="0.00000001" className="w-32" />
          {state.errors?.fxRate && <span className="text-xs text-destructive">{state.errors.fxRate[0]}</span>}
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ci-confidenceLevel" className="text-xs">
          درجة الثقة
        </Label>
        <Select name="confidenceLevel" defaultValue={confidenceLevels[0].value}>
          <SelectTrigger id="ci-confidenceLevel">
            <SelectValue>
              {(value: string) => confidenceLevels.find((c) => c.value === value)?.label ?? value}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {confidenceLevels.map((c) => (
              <SelectItem key={c.value} value={c.value}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "جاري الإضافة..." : "+ إضافة بند"}
      </Button>
      {state.formError && <p role="alert" className="w-full text-sm text-destructive">{state.formError}</p>}
    </form>
  );
}
