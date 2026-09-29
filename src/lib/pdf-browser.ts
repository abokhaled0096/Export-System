import type { Browser } from "puppeteer-core";

/**
 * متصفّح واحد مشترك لكل مولّدات الـPDF.
 *
 * ⚠️ لازم يفضل singleton **على مستوى العملية كلها** مش لكل ملف: كل نسخة Chromium بتاخد
 * مئات الميجات، ودالة Vercel واحدة بتشغّل اتنين هتقع بـOOM. أي مولّد PDF جديد بيستورد
 * `getPdfBrowser()` من هنا، ما بيعملش `launch` بتاعه.
 *
 * Vercel serverless مالهاش نظام تشغيل كامل يشغّل Chromium العادي (حجم كبير + مكتبات نظام
 * ناقصة) — لازم Chromium مُبني للـserverless (@sparticuz/chromium) + "puppeteer-core"
 * الخفيف. محليًا بنستخدم "puppeteer" الكاملة، أبسط وبتنزّل Chromium بمفردها.
 * الاختيار وقت التشغيل (process.env.VERCEL بيتحطّ تلقائيًا في أي بيئة Vercel).
 */
async function launchBrowser(): Promise<Browser> {
  if (process.env.VERCEL) {
    const [{ default: chromium }, { default: puppeteerCore }] = await Promise.all([
      import("@sparticuz/chromium"),
      import("puppeteer-core"),
    ]);
    return puppeteerCore.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    });
  }
  const { default: puppeteerFull } = await import("puppeteer");
  const browser = await puppeteerFull.launch({ headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox"] });
  // "puppeteer" مبني فوق "puppeteer-core" فعليًا (نفس الـBrowser class جوّاه) — الكاست هنا
  // بس بيوصف النوع للـTypeScript، مش تغيير سلوك وقت التشغيل.
  return browser as unknown as Browser;
}

let browserPromise: Promise<Browser> | null = null;

export function getPdfBrowser(): Promise<Browser> {
  if (!browserPromise) browserPromise = launchBrowser();
  return browserPromise;
}

/** بيفتح صفحة، يحطّ الـHTML، يطلّع PDF بمقاس A4، ويقفل الصفحة مهما حصل. */
export async function renderHtmlToPdf(html: string): Promise<Buffer> {
  const browser = await getPdfBrowser();
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: "load" });
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "0", bottom: "0", left: "0", right: "0" },
    });
    return Buffer.from(pdf);
  } finally {
    await page.close();
  }
}
