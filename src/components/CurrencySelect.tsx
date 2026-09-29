"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CURRENCIES, currencyLabel } from "@/lib/currencies";

/**
 * اختيار العملة — بديل خانة النص المفتوحة اللي كانت في ٣٤ فورم.
 *
 * بيرسم الـSelect بس (بلا Label ولا wrapper) عشان يبقى **بديل مباشر لـ`<Input>`** في
 * مكانه بالظبط — كل فورم عنده الـLabel والتنسيق بتاعه، ومحاولة توحيدهم كانت هتتطلّب
 * تعديل ٣٤ بلوك بأشكال مختلفة بدل سطر واحد في كل واحد.
 *
 * `key` بيتمرّر من بره في الفورمات اللي العملة بتتملّى فيها من اختيار تاني (مثلًا اختيار
 * حساب بنكي بيحدّد عملة الدفعة) — تغيير الـkey بيعيد بناء المكوّن بالقيمة الجديدة، نفس
 * النمط المستخدم في باقي الفورمات.
 */
export default function CurrencySelect({
  id,
  name = "currency",
  defaultValue = "EGP",
  value,
  onValueChange,
  disabled,
  className,
}: {
  id?: string;
  name?: string;
  defaultValue?: string;
  /** للفورمات اللي بتتحكّم في العملة بنفسها (مسوّدة محفوظة، أو حقل بيأثّر على حقل تاني). */
  value?: string;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  // إما متحكَّم فيه بالكامل من بره، أو غير متحكَّم فيه بالكامل — الخلط بين الاتنين بيخلّي
  // React يحذّر وبيخلّي القيمة تتجمّد على أول قيمة.
  const controlled = value !== undefined;
  return (
    <Select
      name={name}
      {...(controlled
        ? { value, onValueChange: (v: string | null) => onValueChange?.(v ?? "") }
        : { defaultValue: defaultValue || "EGP" })}
      disabled={disabled}
    >
      <SelectTrigger id={id} className={className}>
        <SelectValue>{(value: string) => currencyLabel(value)}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {CURRENCIES.map((c) => (
          <SelectItem key={c.code} value={c.code}>
            {c.code} — {c.nameAr}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
