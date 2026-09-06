"use client";

import { useEffect, useRef, useState } from "react";

/**
 * حفظ تلقائي لقيم فورم طويل في localStorage (تخزين محلي في متصفح المستخدم بس، مش على السيرفر)
 * — بيحل فقدان البيانات الصامت لو الجلسة انتهت وسط الكتابة (`requireCurrentUser()` بيرحّل
 * لصفحة تسجيل الدخول، وده تنقّل كامل بيمسح أي state في الصفحة)، أو لو التاب اتقفل بالغلط.
 * راجع BACKLOG.md § فقدان بيانات صامت.
 *
 * الاستخدام: state واحد لكل حقول الفورم (مش useState منفصل لكل حقل)، بيتحفظ في localStorage
 * بعد كل تغيير (debounced 500ms)، وبيتمسح تلقائيًا بعد submit ناجح (نادِ clearDraft()).
 */
/** مسودة أقدم من كده بنتجاهلها — بديل معقول لمحاولة رصد "نجح الإرسال" (مستحيل موثوق هنا لأن
 * الإجراء الناجح بيعمل redirect كامل، فمفيش لحظة "success" جوه نفس مكوّن React نقدر نمسك بيها
 * ونمسح المسودة فيها قبل ما المكوّن يختفي). بعد المدة دي، أي مسودة قديمة (اتبعتت بنجاح أو
 * اتسابت) بتختفي من تلقاء نفسها بدل ما تفضل تظهر تاني وتلخبط أول محاولة جديدة. */
const DRAFT_TTL_MS = 6 * 60 * 60 * 1000;

export function useFormDraft(key: string) {
  const storageKey = `draft:${key}`;
  const [values, setValues] = useState<Record<string, string>>({});
  const [hasRestoredDraft, setHasRestoredDraft] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // بيتقرا بس بعد أول render (مش وقت الـSSR) — عشان مفيش hydration mismatch. فلاش بسيط
  // (فراغ ثم القيم المسترجعة) مقبول هنا مقابل تجنّب تحذيرات الـhydration.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved) as { values: Record<string, string>; savedAt: number };
        if (Date.now() - parsed.savedAt < DRAFT_TTL_MS) {
          setValues(parsed.values);
          setHasRestoredDraft(true);
        } else {
          localStorage.removeItem(storageKey);
        }
      }
    } catch {
      // localStorage ممكن يرمي في نافذة خاصة/إعدادات متصفح معيّنة — نتجاهل بأمان.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  const setField = (name: string, value: string) => {
    setValues((prev) => {
      const next = { ...prev, [name]: value };
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        try {
          localStorage.setItem(storageKey, JSON.stringify({ values: next, savedAt: Date.now() }));
        } catch {}
      }, 500);
      return next;
    });
  };

  const clearDraft = () => {
    try {
      localStorage.removeItem(storageKey);
    } catch {}
    setValues({});
    setHasRestoredDraft(false);
  };

  return { values, setField, clearDraft, hasRestoredDraft };
}
