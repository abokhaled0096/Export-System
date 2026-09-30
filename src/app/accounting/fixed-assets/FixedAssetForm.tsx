"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createFixedAsset, type FixedAssetFormState } from "../finance-actions";
import { fixedAssetCategoryLabel, depreciationMethodLabel } from "@/lib/treasuryLabels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import CurrencySelect from "@/components/CurrencySelect";
import { Form } from "@/components/ui/form";

const initialState: FixedAssetFormState = {};
const categories = Object.keys(fixedAssetCategoryLabel);

export type CostCenterOption = { id: string; label: string };

export default function FixedAssetForm({ costCenters, functionalCurrency }: { costCenters: CostCenterOption[]; functionalCurrency?: string }) {
  const [state, formAction, pending] = useActionState(createFixedAsset, initialState);
  const router = useRouter();
  const [currency, setCurrency] = useState("EGP");
  const needsFxRate = !!functionalCurrency && currency.trim().toUpperCase() !== functionalCurrency;

  useEffect(() => {
    if (state.assetId) router.push(`/accounting/fixed-assets/${state.assetId}`);
  }, [state.assetId, router]);

  return (
    <Form action={formAction} state={state} className="grid gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="fa-nameAr" className="text-xs">
          الاسم بالعربي *
        </Label>
        <Input id="fa-nameAr" name="nameAr" />
        {state.errors?.nameAr && <span className="text-xs text-destructive">{state.errors.nameAr[0]}</span>}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="fa-nameEn" className="text-xs">
          الاسم بالإنجليزي *
        </Label>
        <Input id="fa-nameEn" name="nameEn" />
        {state.errors?.nameEn && <span className="text-xs text-destructive">{state.errors.nameEn[0]}</span>}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="fa-category" className="text-xs">
          الفئة *
        </Label>
        <Select name="category" defaultValue={categories[0]}>
          <SelectTrigger id="fa-category">
            <SelectValue>{(value: string) => fixedAssetCategoryLabel[value] ?? value}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {categories.map((c) => (
              <SelectItem key={c} value={c}>
                {fixedAssetCategoryLabel[c]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {costCenters.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="fa-cc" className="text-xs">
            مركز التكلفة
          </Label>
          <Select name="costCenterId">
            <SelectTrigger id="fa-cc">
              <SelectValue>{(value: string) => costCenters.find((c) => c.id === value)?.label ?? "— بدون —"}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {costCenters.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="fa-date" className="text-xs">
          تاريخ الشراء *
        </Label>
        <Input id="fa-date" name="purchaseDate" type="date" />
        {state.errors?.purchaseDate && <span className="text-xs text-destructive">{state.errors.purchaseDate[0]}</span>}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="fa-value" className="text-xs">
          قيمة الشراء *
        </Label>
        <Input id="fa-value" name="purchaseValue" type="number" step="0.01" />
        {state.errors?.purchaseValue && <span className="text-xs text-destructive">{state.errors.purchaseValue[0]}</span>}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="fa-currency" className="text-xs">
          العملة *
        </Label>
        <CurrencySelect id="fa-currency" value={currency} onValueChange={setCurrency} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="fa-life" className="text-xs">
          العمر الإنتاجي (شهور) *
        </Label>
        <Input id="fa-life" name="usefulLifeMonths" type="number" step="1" />
        {state.errors?.usefulLifeMonths && <span className="text-xs text-destructive">{state.errors.usefulLifeMonths[0]}</span>}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="fa-method" className="text-xs">
          طريقة الإهلاك
        </Label>
        <Select name="depreciationMethod" defaultValue="StraightLine">
          <SelectTrigger id="fa-method">
            <SelectValue>{(value: string) => depreciationMethodLabel[value] ?? value}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="StraightLine">{depreciationMethodLabel.StraightLine}</SelectItem>
            <SelectItem value="DecliningBalance">{depreciationMethodLabel.DecliningBalance}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {needsFxRate && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="fa-fxrate" className="text-xs">
            {`سعر الصرف (1 ${currency.trim().toUpperCase()} = ؟ ${functionalCurrency})`}
          </Label>
          <Input id="fa-fxrate" name="fxRate" type="number" step="0.00000001" />
        </div>
      )}

      <div className="flex items-end">
        <Button type="submit" disabled={pending}>
          {pending ? "جاري التسجيل..." : "+ أصل ثابت"}
        </Button>
      </div>

      <p className="text-xs text-muted-foreground sm:col-span-2 lg:col-span-3">
        الشراء بيترحّل تلقائيًا (مدين الأصول الثابتة بالتكلفة / دائن نقدية).
      </p>

      {state.formError && (
        <p role="alert" className="text-sm text-destructive sm:col-span-2 lg:col-span-3">
          {state.formError}
        </p>
      )}
    </Form>
  );
}
