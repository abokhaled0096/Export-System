"use client";

import { useActionState } from "react";
import { saveDealActual, type DealActualFormState } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form } from "@/components/ui/form";

const initialState: DealActualFormState = {};

/** الحقول مجمّعة زي ما المواصفة مرتّباها (§٢٧) — الكميات، التكاليف، التحصيل. */
const QUANTITY_FIELDS: [string, string][] = [
  ["actualQuantityRaw", "الكمية الخام"],
  ["actualQuantitySaleable", "القابل للبيع"],
  ["actualWasteQuantity", "الفاقد"],
];

const COST_FIELDS: [string, string][] = [
  ["actualPurchasePrice", "سعر الشراء/وحدة"],
  ["actualProcessingCost", "التشغيل"],
  ["actualPackagingCost", "التعبئة"],
  ["actualInlandTransport", "النقل الداخلي"],
  ["actualPortCharges", "رسوم الميناء"],
  ["actualFreight", "الشحن"],
  ["actualBankCharges", "رسوم البنك"],
  ["actualFinanceCost", "التمويل"],
  ["penalties", "الغرامات"],
  ["claims", "المطالبات"],
  ["postSaleDeductions", "خصومات لاحقة"],
  ["unexpectedCosts", "تكاليف غير متوقّعة"],
];

export default function DealActualForm({
  dealId,
  scenarios,
  current,
  currency,
}: {
  dealId: string;
  scenarios: { id: string; label: string }[];
  current: Record<string, string> | null;
  currency: string;
}) {
  const action = saveDealActual.bind(null, dealId);
  const [state, formAction, pending] = useActionState(action, initialState);
  const val = (k: string) => current?.[k] ?? "";

  return (
    <Form action={formAction} state={state} className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="da-scenario" className="text-xs">
          السيناريو اللي اتسعّر بيه *
        </Label>
        <Select name="scenarioId" defaultValue={val("scenarioId") || scenarios[0]?.id}>
          <SelectTrigger id="da-scenario" className="w-full sm:w-72">
            <SelectValue placeholder="اختر السيناريو">
              {(v: string) => scenarios.find((s) => s.id === v)?.label ?? v}
            </SelectValue>
          </SelectTrigger>
          <SelectContent emptyHint="مفيش سيناريوهات على الصفقة دي — اعمل سيناريو وسعّره الأول.">
            {scenarios.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {state.errors?.scenarioId && <span className="text-xs text-destructive">{state.errors.scenarioId[0]}</span>}
      </div>

      <fieldset className="mt-4">
        <legend className="text-xs text-muted-foreground">الكميات الفعلية</legend>
        <p className="mt-0.5 text-xs text-muted-foreground">
          الخام = القابل للبيع + الفاقد — القاعدة بترفض غير كده.
        </p>
        <div className="mt-2 grid gap-3 sm:grid-cols-3">
          {QUANTITY_FIELDS.map(([name, label]) => (
            <div key={name} className="flex flex-col gap-1.5">
              <Label htmlFor={`da-${name}`} className="text-xs">
                {label}
              </Label>
              <Input id={`da-${name}`} name={name} type="number" step="0.001" defaultValue={val(name)} />
              {state.errors?.[name] && <span className="text-xs text-destructive">{state.errors[name][0]}</span>}
            </div>
          ))}
        </div>
      </fieldset>

      <fieldset className="mt-4">
        <legend className="text-xs text-muted-foreground">التكاليف الفعلية ({currency})</legend>
        <p className="mt-0.5 text-xs text-muted-foreground">
          سيب الخانة فاضية لو البند ده مش متسجّل — الفاضي معناه «مش معروف» مش «صفر».
        </p>
        <div className="mt-2 grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {COST_FIELDS.map(([name, label]) => (
            <div key={name} className="flex flex-col gap-1.5">
              <Label htmlFor={`da-${name}`} className="text-xs">
                {label}
              </Label>
              <Input id={`da-${name}`} name={name} type="number" step="0.01" defaultValue={val(name)} />
              {state.errors?.[name] && <span className="text-xs text-destructive">{state.errors[name][0]}</span>}
            </div>
          ))}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="da-fxDifference" className="text-xs">
              فرق العملة
            </Label>
            {/* ⚠️ الوحيد اللي بيقبل سالب: مكسب صرف بيقلّل التكلفة. */}
            <Input id="da-fxDifference" name="fxDifference" type="number" step="0.01" defaultValue={val("fxDifference")} />
            <span className="text-xs text-muted-foreground">سالب = مكسب</span>
          </div>
        </div>
        <div className="mt-3 flex flex-col gap-1.5">
          <Label htmlFor="da-note" className="text-xs">
            بيان التكاليف غير المتوقّعة
          </Label>
          <Input id="da-note" name="unexpectedCostsNote" defaultValue={val("unexpectedCostsNote")} />
        </div>
      </fieldset>

      <fieldset className="mt-4">
        <legend className="text-xs text-muted-foreground">التحصيل</legend>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="da-amountCollected" className="text-xs">
              المبلغ المحصَّل ({currency})
            </Label>
            <Input id="da-amountCollected" name="amountCollected" type="number" step="0.01" defaultValue={val("amountCollected")} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="da-collectedAt" className="text-xs">
              تاريخ التحصيل
            </Label>
            <Input id="da-collectedAt" name="collectedAt" type="date" defaultValue={val("collectedAt")} />
          </div>
        </div>
      </fieldset>

      <div className="mt-4 flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "جاري الحفظ..." : current ? "تحديث النتيجة الفعلية" : "حفظ النتيجة الفعلية"}
        </Button>
        <span className="text-xs text-muted-foreground">
          ينفع تحفظ على مراحل — التكاليف دلوقتي والتحصيل لما يحصل.
        </span>
      </div>
      {state.formError && <p role="alert" className="mt-2 text-sm text-destructive">{state.formError}</p>}
    </Form>
  );
}
