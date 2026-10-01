"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * ⚠️ الضغط على عنوان مربع الاختيار (checkbox) مكانش بيعلّمه.
 *
 * مكوّنات Base UI (Checkbox/Switch/RadioGroup) بترسم `<button role="checkbox">` مش
 * `<input type="checkbox">`. و`<label htmlFor>` بيشتغل مع عناصر الإدخال الأصلية بس —
 * فالعنوان كان بيبقى نص ميّت جنب مربع صغير 16px، والمستخدم يدوس عليه وما يحصلش حاجة.
 *
 * اتكشف في شاشة قواعد فصل المهام (1 أكتوبر) وبيأثّر على كل مربعات الاختيار في المنظومة
 * (٢٠ شاشة). مساحة الضغط 16px لوحدها صغيرة خصوصًا على الموبايل.
 *
 * الحل: لو `htmlFor` بيشاور على عنصر بـ`role` من النوع اللي بيتعلّم، بنعمل له `click()`
 * بنفسنا. العناصر الأصلية مابنلمسهاش — المتصفح بيتعامل معاها صح لوحده.
 */
const ROLES_NEEDING_FORWARD = new Set(["checkbox", "switch", "radio"])

function Label({ className, onClick, htmlFor, ...props }: React.ComponentProps<"label">) {
  function handleClick(event: React.MouseEvent<HTMLLabelElement>) {
    onClick?.(event)
    if (event.defaultPrevented || !htmlFor) return
    const target = document.getElementById(htmlFor)
    if (!target || target instanceof HTMLInputElement) return
    const role = target.getAttribute("role")
    if (role && ROLES_NEEDING_FORWARD.has(role)) {
      event.preventDefault()
      target.click()
    }
  }

  return (
    <label
      data-slot="label"
      htmlFor={htmlFor}
      onClick={handleClick}
      className={cn(
        "flex items-center gap-2 text-sm leading-none font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
}

export { Label }
