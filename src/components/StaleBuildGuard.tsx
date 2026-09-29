"use client";

import { useEffect } from "react";

/**
 * حارس البناء القديم.
 *
 * **المشكلة**: بعد أي نشر جديد، التبويب اللي كان مفتوح بيفضل ماسك أسماء ملفات JS من
 * البناء القديم. أول ما يحتاج chunk لسه ما اتحمّلش (أي انتقال لصفحة جديدة)، الطلب بيرجّع
 * 404 لأن البناء القديم اتشال. النتيجة: الصفحة بتقف — وفي أسوأ الحالات على «جاري
 * التحميل» بلا نهاية.
 *
 * **ليه المكوّن ده في `layout.tsx` مش في `loading.tsx`**: جرّبت الأول أحط الحارس جوه
 * `loading.tsx`، وطلع إن `useEffect` **مابيشتغلش خالص** جوه حدّ Suspense وهو لسه معلّق —
 * React مابيعملش hydration للـfallback قبل ما الحدّ يتحلّ. اتأكدت من ده بصفحة فحص بتعلّق
 * عمدًا: عدّت ٢٢ ثانية والحارس ما اشتغلش. الـlayout بيتعمله hydration عادي، فالحارس هنا
 * شغّال فعلًا.
 *
 * **ليه listener على الأخطاء مش مؤقّت**: المؤقّت مايعرفش يفرّق بين «صفحة بطيئة» و«صفحة
 * واقفة»، وإعادة تحميل صفحة بطيئة بجد أسوأ من الانتظار. فشل تحميل chunk بيرمي خطأ له
 * بصمة واضحة، فالتصرّف بيبقى مبني على إشارة أكيدة مش تخمين.
 */

// البصمات دي بتغطّي Chrome وFirefox وSafari — كل واحد بيصيغ الرسالة بطريقته.
const CHUNK_ERROR = /ChunkLoadError|Loading chunk .* failed|Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed/i;

function isStaleChunkError(reason: unknown): boolean {
  if (!reason) return false;
  const name = (reason as { name?: string }).name ?? "";
  const message = (reason as { message?: string }).message ?? String(reason);
  return name === "ChunkLoadError" || CHUNK_ERROR.test(message);
}

/**
 * ⚠️ `location.reload()` العادي مش كفاية — بيرجّع نفس المستند من كاش المتصفح ومعاه نفس
 * روابط الـchunks القديمة. باراميتر متغيّر بيجبر طلب مستند جديد بأسماء البناء الحالي.
 */
function hardReload() {
  const url = new URL(window.location.href);
  url.searchParams.set("_r", String(Date.now()));
  window.location.replace(url.toString());
}

export default function StaleBuildGuard() {
  useEffect(() => {
    // مرة واحدة بس لكل مسار في الجلسة: من غير الحارس ده، خطأ تحميل متكرر لأي سبب تاني
    // (شبكة مقطوعة مثلًا) هيدخل الصفحة في حلقة إعادة تحميل لا نهائية — علاج أسوأ من المرض.
    const guardKey = `stale-build-reloaded:${window.location.pathname}`;

    function recover(reason: unknown) {
      if (!isStaleChunkError(reason)) return;
      try {
        if (sessionStorage.getItem(guardKey)) return;
        sessionStorage.setItem(guardKey, "1");
      } catch {
        return; // تصفّح خاص أو تخزين مقفول — ما نعملش إعادة تلقائية بلا حارس
      }
      hardReload();
    }

    const onError = (e: ErrorEvent) => recover(e.error ?? e.message);
    const onRejection = (e: PromiseRejectionEvent) => recover(e.reason);

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}
