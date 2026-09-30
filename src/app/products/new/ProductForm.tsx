"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { createProduct, type ProductFormState } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { COUNTRIES_AR } from "@/lib/countries";
import { Form } from "@/components/ui/form";

const initialState: ProductFormState = {};
const monthLabel = ["", "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
const PRODUCT_CATEGORIES = ["فواكه طازجة", "فواكه مجمدة", "فواكه مجففة", "خضروات", "حبوب"];
const HARVEST_SEASONS = ["الشتاء", "الربيع", "الصيف", "الخريف", "على مدار السنة"];

function Field({
  label,
  name,
  error,
  required,
  type = "text",
  placeholder,
}: {
  label: string;
  name: string;
  error?: string[];
  required?: boolean;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={name}>
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      <Input id={name} name={name} type={type} placeholder={placeholder} />
      {error && <span className="text-xs text-destructive">{error[0]}</span>}
    </div>
  );
}

export default function ProductForm() {
  const [state, formAction, pending] = useActionState(createProduct, initialState);
  const router = useRouter();

  return (
    <Form action={formAction} state={state} className="flex max-w-xl flex-col gap-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="الاسم بالعربية" name="nameAr" error={state.errors?.nameAr} required />
        <Field label="Name (English)" name="nameEn" error={state.errors?.nameEn} required />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field
          label="HS Code"
          name="hsCode"
          error={state.errors?.hsCode}
          required
          placeholder="0811.10"
        />
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="category">
            الفئة<span className="text-destructive"> *</span>
          </Label>
          <Select name="category" defaultValue={PRODUCT_CATEGORIES[0]}>
            <SelectTrigger id="category">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRODUCT_CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {state.errors?.category && <span className="text-xs text-destructive">{state.errors.category[0]}</span>}
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="originCountry">
            بلد المنشأ<span className="text-destructive"> *</span>
          </Label>
          <Select name="originCountry" defaultValue="مصر">
            <SelectTrigger id="originCountry">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COUNTRIES_AR.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {state.errors?.originCountry && <span className="text-xs text-destructive">{state.errors.originCountry[0]}</span>}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="harvestSeason">موسم الحصاد</Label>
          <Select name="harvestSeason">
            <SelectTrigger id="harvestSeason">
              <SelectValue placeholder="— غير محدد —" />
            </SelectTrigger>
            <SelectContent>
              {HARVEST_SEASONS.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {state.errors?.harvestSeason && <span className="text-xs text-destructive">{state.errors.harvestSeason[0]}</span>}
        </div>
      </div>
      <div className="grid items-end gap-4 grid-cols-1 sm:grid-cols-2">
        <Field
          label="مدة الصلاحية (يوم)"
          name="shelfLifeDays"
          type="number"
          error={state.errors?.shelfLifeDays}
        />
        <Label className="flex items-center gap-2 pb-2 font-normal">
          <Checkbox name="requiresRefrigeration" />
          يحتاج تبريد
        </Label>
      </div>

      <Field
        label="درجة حرارة التخزين (°C)"
        name="storageTempC"
        type="number"
        error={state.errors?.storageTempC}
      />

      <div className="flex flex-col gap-1.5">
        <Label className="text-xs">شهور توفّر المنتج عندنا (موسميًا)</Label>
        <div className="grid grid-cols-4 gap-1.5">
          {monthLabel.slice(1).map((label, i) => (
            <label key={i} className="flex items-center gap-1 text-xs">
              <input type="checkbox" name="availableMonths" value={i + 1} className="size-3.5" />
              {label}
            </label>
          ))}
        </div>
        {state.errors?.availableMonths && <span className="text-xs text-destructive">{state.errors.availableMonths[0]}</span>}
      </div>

      {state.duplicateWarning && (
        <div className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
          <p>{state.duplicateWarning}</p>
          <Label className="mt-2 flex items-center gap-2 font-normal">
            <Checkbox name="confirmDuplicate" defaultChecked />
            أيوه، ده منتج مختلف فعلًا — كمّل الحفظ
          </Label>
        </div>
      )}

      {state.formError && (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.formError}</p>
      )}

      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={pending}>
          {pending ? "جاري الحفظ..." : "حفظ المنتج"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push("/products")}>
          إلغاء
        </Button>
      </div>
    </Form>
  );
}
