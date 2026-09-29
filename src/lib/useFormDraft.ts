"use client";

import { useCallback, useMemo, useRef, useState, useSyncExternalStore } from "react";

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

const EMPTY: Record<string, string> = Object.freeze({});

/**
 * ⚠️ الكاش ده **شرط لصحة `useSyncExternalStore`** مش تحسين أداء: الدالة لازم ترجّع نفس
 * المرجع لو البيانات ما اتغيرتش، وإلا React يفضل يعيد الرندر بلا نهاية.
 */
const snapshotCache = new Map<string, Record<string, string>>();

function readDraft(storageKey: string): Record<string, string> {
  const cached = snapshotCache.get(storageKey);
  if (cached) return cached;

  let restored = EMPTY;
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      const parsed = JSON.parse(saved) as { values: Record<string, string>; savedAt: number };
      if (Date.now() - parsed.savedAt < DRAFT_TTL_MS) restored = parsed.values;
      else localStorage.removeItem(storageKey);
    }
  } catch {
    // localStorage ممكن يرمي في نافذة خاصة/إعدادات متصفح معيّنة — نتجاهل بأمان.
  }
  snapshotCache.set(storageKey, restored);
  return restored;
}

/** المسودة ما بتتغيّرش من برّه أثناء عمر المكوّن — مفيش اشتراك حقيقي محتاجينه. */
const subscribe = () => () => {};

/**
 * overrides: قيم صريحة (من query params زي "حوّل لفرصة" من صفحة تحليل، أو "+ فرصة جديدة" من
 * صفحة شركة معيّنة) بتتطبّق *فوق* المسودة المسترجعة. بيتطبّق مرة واحدة بس عند التحميل — بعد
 * كده val(name) هو مصدر الحقيقة الوحيد وقابل للتعديل بحرية زي أي حقل تاني.
 */
export function useFormDraft(key: string, overrides?: Record<string, string>) {
  const storageKey = `draft:${key}`;

  /**
   * ⚠️ `useSyncExternalStore` مش `useEffect`: قراءة localStorage جوه effect كانت بتتطلّب
   * `setState` متزامن جوه الـeffect (بيسبّب رندرات متتالية — `react-hooks/set-state-in-effect`).
   * الـhook ده هو النمط الرسمي لقراءة مصدر موجود في المتصفح بس: بيرجّع لقطة السيرفر (فاضية)
   * أثناء الـSSR والـhydration فمفيش تعارض، وبعدها بيعيد الرندر باللقطة الحقيقية.
   */
  const restored = useSyncExternalStore(
    subscribe,
    () => readDraft(storageKey),
    () => EMPTY
  );

  // القيم اللي المستخدم كتبها فوق الأساس. الفصل ده هو اللي بيخلّي الأساس مشتقّ (مش state)،
  // فمفيش أصلًا حاجة محتاجة تتزامن في effect.
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [cleared, setCleared] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // بتتحسب من أول render بس (مُهيِّئ كسول)، وبعدها ثابتة. من غير كده، أي كائن overrides
  // جديد بيتبعت في كل رندر (وهو الشائع) كان هيرجّع القيم المكتوبة لأصلها.
  // ⚠️ useState مش useRef: قراءة ref أثناء الرندر ممنوعة (react-hooks/refs)، والـstate
  // بمُهيِّئ كسول هو الأداة الصح لـ"قيمة تتحسب مرة واحدة وتتقرا في الرندر".
  const [initialOverrides] = useState(() =>
    Object.fromEntries(Object.entries(overrides ?? {}).filter(([, v]) => v))
  );

  const baseline = useMemo(() => {
    if (cleared) return EMPTY;
    return Object.keys(initialOverrides).length > 0 ? { ...restored, ...initialOverrides } : restored;
  }, [restored, cleared, initialOverrides]);

  const values = useMemo(() => ({ ...baseline, ...edits }), [baseline, edits]);

  const setField = useCallback(
    (name: string, value: string) => {
      setEdits((prev) => {
        const nextEdits = { ...prev, [name]: value };
        // بنحفظ القيم الكاملة (الأساس + التعديلات) مش التعديلات لوحدها — المسودة المسترجعة
        // لازم تبقى صورة كاملة للفورم.
        const full = { ...baseline, ...nextEdits };
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
          try {
            localStorage.setItem(storageKey, JSON.stringify({ values: full, savedAt: Date.now() }));
          } catch {}
        }, 500);
        return nextEdits;
      });
    },
    [baseline, storageKey]
  );

  const clearDraft = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    try {
      localStorage.removeItem(storageKey);
    } catch {}
    // الكاش لازم يتفضّى كمان، وإلا لقطة `useSyncExternalStore` هترجّع المسودة الممسوحة.
    snapshotCache.delete(storageKey);
    setEdits({});
    setCleared(true);
  }, [storageKey]);

  return { values, setField, clearDraft, hasRestoredDraft: !cleared && restored !== EMPTY };
}
