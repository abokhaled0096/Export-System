"use client";

import { useActionState } from "react";
import { createScenario, type ScenarioFormState } from "../../../actions";
import { useFormDraft } from "@/lib/useFormDraft";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import CurrencySelect from "@/components/CurrencySelect";
import { Form } from "@/components/ui/form";

const initialState: ScenarioFormState = {};

const incoterms = ["EXW", "FCA", "FAS", "FOB", "CFR", "CIF", "CPT", "CIP", "DAP", "DPU", "DDP"];

export default function ScenarioForm({ dealId }: { dealId: string }) {
  const action = createScenario.bind(null, dealId);
  const [state, formAction, pending] = useActionState(action, initialState);

  const field = (name: keyof NonNullable<ScenarioFormState["errors"]>) => state.errors?.[name]?.[0];

  // حفظ تلقائي محلي في المتصفح لقيم الفورم — بديل لفقدان البيانات صامتًا لو الجلسة انتهت
  // وسط الكتابة (redirect كامل لصفحة الدخول بيمسح أي state في الصفحة). راجع BACKLOG.md.
  const draft = useFormDraft(`scenario-new-${dealId}`);
  const val = (name: string) => draft.values[name] ?? "";

  return (
    <Form action={formAction} state={state} className="flex max-w-xl flex-col gap-5">
      {draft.hasRestoredDraft && (
        <div className="flex items-center justify-between rounded-lg bg-sky-50 px-3 py-2 text-xs text-sky-800">
          <span>استرجعنا مسودة كنت بتكتبها قبل كده.</span>
          <Button type="button" variant="link" className="h-auto p-0 text-xs" onClick={draft.clearDraft}>
            امسح المسودة وابدأ من جديد
          </Button>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="scenarioName">اسم السيناريو *</Label>
        <Input
          id="scenarioName"
          name="scenarioName"
          placeholder="مثال: السيناريو الأساسي / أفضل حالة / أسوأ حالة"
          value={val("scenarioName")}
          onChange={(e) => draft.setField("scenarioName", e.target.value)}
        />
        {field("scenarioName") && <span className="text-xs text-destructive">{field("scenarioName")}</span>}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="quantityRaw">الكمية الخام *</Label>
          <Input
            id="quantityRaw"
            name="quantityRaw"
            type="number"
            step="0.001"
            value={val("quantityRaw")}
            onChange={(e) => draft.setField("quantityRaw", e.target.value)}
          />
          {field("quantityRaw") && <span className="text-xs text-destructive">{field("quantityRaw")}</span>}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="yieldRate">معدّل التصافي (0-1)</Label>
          <Input
            id="yieldRate"
            name="yieldRate"
            type="number"
            step="0.0001"
            placeholder="0.85"
            value={val("yieldRate")}
            onChange={(e) => draft.setField("yieldRate", e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="incoterm">Incoterm *</Label>
          <Select name="incoterm" value={val("incoterm") || incoterms[3]} onValueChange={(v) => draft.setField("incoterm", v ?? "")}>
            <SelectTrigger id="incoterm" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {incoterms.map((i) => (
                <SelectItem key={i} value={i}>
                  {i}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="namedPlace">المكان المسمّى</Label>
          <Input
            id="namedPlace"
            name="namedPlace"
            placeholder="Alexandria Port"
            value={val("namedPlace")}
            onChange={(e) => draft.setField("namedPlace", e.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="currency">العملة *</Label>
        <CurrencySelect
          id="currency"
          value={val("currency") || "USD"}
          onValueChange={(v) => draft.setField("currency", v)}
        />
        {field("currency") && <span className="text-xs text-destructive">{field("currency")}</span>}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="walkAwayPrice">الحد الأدنى للسعر (walkAwayPrice) *</Label>
        <Input
          id="walkAwayPrice"
          name="walkAwayPrice"
          type="number"
          step="0.0001"
          value={val("walkAwayPrice")}
          onChange={(e) => draft.setField("walkAwayPrice", e.target.value)}
        />
        {field("walkAwayPrice") && <span className="text-xs text-destructive">{field("walkAwayPrice")}</span>}
        <span className="text-xs text-muted-foreground">
          أي عرض سعر لاحق تحت الرقم ده هيترفض تلقائيًا على مستوى قاعدة البيانات.
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="openingPrice">السعر الافتتاحي (أول عرض للعميل)</Label>
          <Input
            id="openingPrice"
            name="openingPrice"
            type="number"
            step="0.0001"
            value={val("openingPrice")}
            onChange={(e) => draft.setField("openingPrice", e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="targetPrice">السعر المستهدف</Label>
          <Input
            id="targetPrice"
            name="targetPrice"
            type="number"
            step="0.0001"
            value={val("targetPrice")}
            onChange={(e) => draft.setField("targetPrice", e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="financeCost">تكلفة التمويل</Label>
          <Input
            id="financeCost"
            name="financeCost"
            type="number"
            step="0.01"
            value={val("financeCost")}
            onChange={(e) => draft.setField("financeCost", e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="riskReserve">احتياطي المخاطر</Label>
          <Input
            id="riskReserve"
            name="riskReserve"
            type="number"
            step="0.01"
            value={val("riskReserve")}
            onChange={(e) => draft.setField("riskReserve", e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="paymentTerms">شروط الدفع</Label>
          <Input
            id="paymentTerms"
            name="paymentTerms"
            placeholder="30% مقدّم، الباقي ضد المستندات"
            value={val("paymentTerms")}
            onChange={(e) => draft.setField("paymentTerms", e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="advanceRatePct">نسبة المقدّم %</Label>
          <Input
            id="advanceRatePct"
            name="advanceRatePct"
            type="number"
            step="0.01"
            min="0"
            max="100"
            value={val("advanceRatePct")}
            onChange={(e) => draft.setField("advanceRatePct", e.target.value)}
          />
          {field("advanceRatePct") && <span className="text-xs text-destructive">{field("advanceRatePct")}</span>}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="creditDays">أيام الائتمان</Label>
          <Input
            id="creditDays"
            name="creditDays"
            type="number"
            step="1"
            min="0"
            value={val("creditDays")}
            onChange={(e) => draft.setField("creditDays", e.target.value)}
          />
          {field("creditDays") && <span className="text-xs text-destructive">{field("creditDays")}</span>}
        </div>
      </div>

      {state.formError && (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.formError}</p>
      )}

      <Button type="submit" disabled={pending} className="w-fit">
        {pending ? "جاري الحفظ..." : "حفظ السيناريو"}
      </Button>
    </Form>
  );
}
