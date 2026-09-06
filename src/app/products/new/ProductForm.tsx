"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { createProduct, type ProductFormState } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

const initialState: ProductFormState = {};
const monthLabel = ["", "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];

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
    <form action={formAction} className="flex max-w-xl flex-col gap-5">
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
        <Field label="الفئة" name="category" error={state.errors?.category} required />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field
          label="بلد المنشأ"
          name="originCountry"
          error={state.errors?.originCountry}
          required
        />
        <Field label="موسم الحصاد" name="harvestSeason" error={state.errors?.harvestSeason} />
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
              {label.slice(0, 3)}
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
    </form>
  );
}
