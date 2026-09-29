import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // الجهاز عنده 16 core لكن ذاكرة محدودة — 15 worker متوازي بيسبب
  // JavaScript heap out of memory أثناء الـbuild. راجع STATUS.md.
  experimental: {
    cpus: 2,
  },
  // puppeteer-core/@sparticuz/chromium (توليد PDF، src/lib/quote-pdf.ts) عندهم ملفات ثنائية
  // (native binaries) — لو Next.js حاول يحزمهم جوه الـbundle العادي بدل ما يسيبهم external،
  // الـbuild بيبقى أبطأ وممكن يكسر. serverExternalPackages بتخلّي Next.js يسيبهم زي ما هم في
  // node_modules وقت التشغيل (السلوك القياسي الموصى بيه لأي مكتبة فيها native binary).
  serverExternalPackages: ["puppeteer-core", "@sparticuz/chromium"],
  // "puppeteer" الكاملة (بيها Chromium مضمّن ~300 ميجا) دي بس للتطوير المحلي — quote-pdf.ts
  // بيتفادى استيرادها خالص لما يكون شغّال على Vercel (process.env.VERCEL)، لكن Next.js لسه بيتتبّع
  // أي import() ديناميكي بالاسم بغض النظر عن شرط التشغيل، فلازم نستبعدها صراحةً من التتبّع (Output
  // File Tracing) عشان مايتحطّش أي جزء منها فعليًا جوه الـserverless function المنشورة على Vercel.
  outputFileTracingExcludes: {
    "*": ["**/node_modules/puppeteer/**"],
  },
  // ⚠️ اتلقط فعليًا في الإنتاج بعد أول deploy: serverExternalPackages لوحده مش كفاية —
  // Next.js Output File Tracing برضو بيشيل مجلد bin/ بتاع @sparticuz/chromium (فيه الـChromium
  // binary نفسه مضغوط بـbrotli) لأنه require() ديناميكي بيتحل وقت التشغيل مش وقت البناء، فالتتبّع
  // الاستاتيكي مايشوفوش. النتيجة: "The input directory .../chromium/bin does not exist" وقت
  // فعلي تشغيل توليد الـPDF. outputFileTracingIncludes بيجبر Next.js يضيف المجلد ده صراحةً لأي
  // route محتاج Chromium (نفس الحل الموثّق في README بتاع @sparticuz/chromium نفسه).
  outputFileTracingIncludes: {
    "*": ["./node_modules/@sparticuz/chromium/bin/**/*"],
  },
};

export default nextConfig;
