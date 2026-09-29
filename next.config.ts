import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ⚠️ علاج السبب الجذري لمشكلة «التبويب القديم بيعلّق على جاري التحميل» (اتلاحظت على
  // الإنتاج ٢٩ سبتمبر): بعد أي نشر، التبويب المفتوح بيطلب chunks من بناء اتشال، الطلب
  // بيفشل جوه Suspense من غير ما يرمي خطأ، والصفحة بتفضل معلقة.
  //
  // deploymentId بيخلّي Next.js يوسم كل طلب أصول بالنشر اللي طلع منه (?dpl=...). لما تكون
  // خاصية Skew Protection مفعّلة في إعدادات مشروع Vercel، الطلب ده بيتوجّه للنشر القديم
  // نفسه فيلاقي ملفاته موجودة بدل 404.
  //
  // ⚠️ محتاجة تفعيل «Skew Protection» من لوحة تحكّم Vercel (Settings → Advanced) عشان
  // تشتغل فعليًا. من غير التفعيل الباراميتر بيتجاهل بلا ضرر. والحارس في
  // src/components/LoadingWatchdog.tsx هو شبكة الأمان اللي بتشتغل في الحالتين.
  deploymentId: process.env.VERCEL_DEPLOYMENT_ID,

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
