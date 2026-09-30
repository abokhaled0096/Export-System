"use client";

import { useActionState } from "react";
import { createMarket, type MarketFormState } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import CurrencySelect from "@/components/CurrencySelect";
import { Form } from "@/components/ui/form";

const initialState: MarketFormState = {};

function Field({
  label,
  name,
  error,
  required,
  placeholder,
}: {
  label: string;
  name: string;
  error?: string[];
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={name}>
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      <Input id={name} name={name} placeholder={placeholder} />
      {error && <span className="text-xs text-destructive">{error[0]}</span>}
    </div>
  );
}

export default function MarketForm() {
  const [state, formAction, pending] = useActionState(createMarket, initialState);

  return (
    <Form action={formAction} state={state} className="flex max-w-xl flex-col gap-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="اسم الدولة بالعربية" name="countryNameAr" error={state.errors?.countryNameAr} required />
        <Field label="Country Name (English)" name="countryNameEn" error={state.errors?.countryNameEn} required />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Field label="كود الدولة" name="countryCode" error={state.errors?.countryCode} required placeholder="DE" />
        <Field label="القارة" name="continent" error={state.errors?.continent} required placeholder="Europe" />
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="market-currency">العملة *</Label>
          <CurrencySelect id="market-currency" defaultValue="EUR" />
          {state.errors?.currency && <span className="text-xs text-destructive">{state.errors.currency[0]}</span>}
        </div>
      </div>
      <Field
        label="الموانئ الرئيسية (مفصولة بفاصلة)"
        name="mainPorts"
        error={state.errors?.mainPorts}
        placeholder="Hamburg, Rotterdam"
      />
      <Field
        label="اتفاقية تجارية (لو موجودة)"
        name="tradeAgreement"
        error={state.errors?.tradeAgreement}
        placeholder="COMESA, EU-Egypt Association Agreement..."
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field
          label="درجة المخاطرة السياسية (0-100)"
          name="politicalRiskScore"
          error={state.errors?.politicalRiskScore}
        />
        <Field
          label="درجة المخاطرة اللوجستية (0-100)"
          name="logisticsRiskScore"
          error={state.errors?.logisticsRiskScore}
        />
      </div>

      {state.formError && (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.formError}</p>
      )}

      <Button type="submit" disabled={pending} className="w-fit">
        {pending ? "جاري الحفظ..." : "حفظ السوق"}
      </Button>
    </Form>
  );
}
