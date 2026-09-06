"use client";

import { useActionState } from "react";
import { createCompany, type CompanyFormState } from "../actions";
import { useFormDraft } from "@/lib/useFormDraft";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const initialState: CompanyFormState = {};

const classifications = [
  "Importer",
  "Distributor",
  "Wholesaler",
  "Retailer",
  "Processor",
  "FoodService",
  "Agent",
  "Broker",
];

export default function CompanyForm() {
  const [state, formAction, pending] = useActionState(createCompany, initialState);

  // حفظ تلقائي محلي في المتصفح — راجع src/lib/useFormDraft.ts وBACKLOG.md § فقدان بيانات صامت.
  const draft = useFormDraft("company-new");
  const val = (name: string) => draft.values[name] ?? "";

  return (
    <form action={formAction} className="flex max-w-xl flex-col gap-5">
      {draft.hasRestoredDraft && (
        <div className="flex items-center justify-between rounded-lg bg-sky-50 px-3 py-2 text-xs text-sky-800">
          <span>استرجعنا مسودة كنت بتكتبها قبل كده.</span>
          <Button type="button" variant="link" className="h-auto p-0 text-xs" onClick={draft.clearDraft}>
            امسح المسودة وابدأ من جديد
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="legalName">الاسم القانوني *</Label>
          <Input id="legalName" name="legalName" value={val("legalName")} onChange={(e) => draft.setField("legalName", e.target.value)} />
          {state.errors?.legalName && (
            <span className="text-xs text-destructive">{state.errors.legalName[0]}</span>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="tradeName">الاسم التجاري</Label>
          <Input id="tradeName" name="tradeName" value={val("tradeName")} onChange={(e) => draft.setField("tradeName", e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="country">الدولة *</Label>
          <Input id="country" name="country" value={val("country")} onChange={(e) => draft.setField("country", e.target.value)} />
          {state.errors?.country && (
            <span className="text-xs text-destructive">{state.errors.country[0]}</span>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="city">المدينة</Label>
          <Input id="city" name="city" value={val("city")} onChange={(e) => draft.setField("city", e.target.value)} />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="classification">التصنيف *</Label>
        <Select
          name="classification"
          value={val("classification") || classifications[0]}
          onValueChange={(v) => draft.setField("classification", v ?? "")}
        >
          <SelectTrigger id="classification" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {classifications.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {state.errors?.classification && (
          <span className="text-xs text-destructive">{state.errors.classification[0]}</span>
        )}
      </div>

      {state.formError && (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.formError}</p>
      )}

      <Button type="submit" disabled={pending} className="w-fit">
        {pending ? "جاري الحفظ..." : "حفظ الشركة"}
      </Button>
    </form>
  );
}
