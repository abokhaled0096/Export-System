"use client";

import { useEffect } from "react";

// لازم يرسم <html>/<body> بنفسه — ده بديل RootLayout كامل لو حصل خطأ جوه الـlayout نفسه
// (نادر عمليًا، لكن مطلوب Next.js convention). مفيش Nav/فونتات هنا عن قصد — أبسط حالة ممكنة
// عشان لو المشكلة في الـlayout نفسه، الصفحة دي تفضل شغّالة برضو.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="ar" dir="rtl">
      <body style={{ fontFamily: "sans-serif", textAlign: "center", padding: "80px 24px" }}>
        <h1 style={{ fontSize: "20px", fontWeight: 600 }}>حصل خطأ غير متوقّع في النظام</h1>
        <p style={{ color: "#737373", marginTop: "8px" }}>من فضلك جدّد الصفحة، ولو استمرت المشكلة ابلّغ الدعم الفني.</p>
        {error.digest && (
          <p style={{ fontFamily: "monospace", fontSize: "12px", color: "#a3a3a3", marginTop: "12px" }}>
            {error.digest}
          </p>
        )}
        <button
          onClick={() => reset()}
          style={{
            marginTop: "20px",
            padding: "8px 20px",
            borderRadius: "8px",
            background: "#047857",
            color: "white",
            border: "none",
            cursor: "pointer",
          }}
        >
          حاول تاني
        </button>
      </body>
    </html>
  );
}
