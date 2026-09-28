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
};

export default nextConfig;
