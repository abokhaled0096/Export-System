import puppeteer from "puppeteer";

export type QuotePdfData = {
  orgLegalName: string;
  orgTaxId: string | null;
  quoteId: string;
  version: number;
  status: string;
  createdAt: Date;
  validUntil: Date | null;
  currency: string;
  incoterm: string;
  namedPlace: string | null;
  unitPrice: string;
  priceUnit: string;
  paymentTerms: string | null;
  quantitySaleable: string;
  totalValue: string;
  productNameAr: string;
  productNameEn: string;
  hsCode: string;
  marketCountryAr: string;
  customerLegalName: string;
  customerCountry: string;
  customerCity: string | null;
  contactName: string | null;
};

export type QuoteBundlePdfData = {
  orgLegalName: string;
  orgTaxId: string | null;
  bundleId: string;
  createdAt: Date;
  customerLegalName: string;
  customerCountry: string;
  customerCity: string | null;
  contactName: string | null;
  items: {
    quoteId: string;
    version: number;
    status: string;
    currency: string;
    incoterm: string;
    namedPlace: string | null;
    unitPrice: string;
    priceUnit: string;
    quantitySaleable: string;
    totalValue: string;
    productNameAr: string;
    productNameEn: string;
    hsCode: string;
  }[];
};

const statusLabelAr: Record<string, string> = {
  Draft: "مسودة",
  PendingApproval: "بانتظار الموافقة",
  Sent: "مُرسَل",
  Accepted: "مقبول",
  Rejected: "مرفوض",
  Expired: "منتهي الصلاحية",
  Superseded: "مُستبدَل",
};

function fmtDate(d: Date | null): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("ar-EG", { year: "numeric", month: "long", day: "numeric" }).format(d);
}

function buildQuoteHtml(q: QuotePdfData): string {
  return `<!doctype html>
<html dir="rtl" lang="ar">
<head>
<meta charset="utf-8" />
<style>
  @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap');
  * { box-sizing: border-box; }
  body {
    font-family: 'IBM Plex Sans Arabic', sans-serif;
    color: #171717;
    margin: 0;
    padding: 40px 48px;
    font-size: 13px;
    line-height: 1.6;
  }
  .mono { font-family: 'IBM Plex Mono', monospace; }
  header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    border-bottom: 3px solid #047857;
    padding-bottom: 16px;
    margin-bottom: 24px;
  }
  .brand { font-size: 20px; font-weight: 700; color: #047857; }
  .brand-sub { font-size: 11px; color: #737373; margin-top: 4px; }
  .doc-title { text-align: left; }
  .doc-title h1 { font-size: 18px; margin: 0; }
  .doc-title p { margin: 4px 0 0; font-size: 11px; color: #737373; }
  .status-badge {
    display: inline-block;
    margin-top: 6px;
    padding: 3px 10px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 600;
    background: #d1fae5;
    color: #047857;
  }
  .grid { display: flex; gap: 32px; margin-bottom: 24px; }
  .col { flex: 1; }
  .label { font-size: 10px; color: #737373; text-transform: uppercase; letter-spacing: 0.03em; margin-bottom: 2px; }
  .value { font-size: 13px; font-weight: 500; margin-bottom: 10px; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th, td { padding: 10px 12px; text-align: right; font-size: 12px; }
  thead th { background: #f5f5f5; color: #737373; font-weight: 500; font-size: 10px; text-transform: uppercase; border-bottom: 1px solid #e5e5e5; }
  tbody td { border-bottom: 1px solid #f0f0f0; }
  tfoot td { font-weight: 700; font-size: 14px; padding-top: 14px; border-top: 2px solid #171717; }
  .price-total { color: #047857; }
  .terms { margin-top: 28px; padding: 16px; background: #fafafa; border-radius: 8px; font-size: 11px; color: #525252; }
  .terms h3 { font-size: 12px; margin: 0 0 8px; color: #171717; }
  footer { margin-top: 40px; padding-top: 12px; border-top: 1px solid #e5e5e5; font-size: 10px; color: #a3a3a3; text-align: center; }
</style>
</head>
<body>
  <header>
    <div>
      <div class="brand">${q.orgLegalName}</div>
      ${q.orgTaxId ? `<div class="brand-sub">الرقم الضريبي: ${q.orgTaxId}</div>` : ""}
    </div>
    <div class="doc-title">
      <h1>عرض سعر تصدير</h1>
      <p class="mono">رقم ${q.quoteId.slice(0, 8)} · نسخة v${q.version}</p>
      <span class="status-badge">${statusLabelAr[q.status] ?? q.status}</span>
    </div>
  </header>

  <div class="grid">
    <div class="col">
      <div class="label">إلى (العميل)</div>
      <div class="value">${q.customerLegalName}</div>
      <div class="label">الدولة</div>
      <div class="value">${q.customerCountry}${q.customerCity ? " · " + q.customerCity : ""}</div>
      ${q.contactName ? `<div class="label">عناية</div><div class="value">${q.contactName}</div>` : ""}
    </div>
    <div class="col">
      <div class="label">تاريخ الإصدار</div>
      <div class="value">${fmtDate(q.createdAt)}</div>
      <div class="label">صالح حتى</div>
      <div class="value">${fmtDate(q.validUntil)}</div>
      <div class="label">السوق المستهدف</div>
      <div class="value">${q.marketCountryAr}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>المنتج</th>
        <th>HS Code</th>
        <th>الكمية</th>
        <th>Incoterm</th>
        <th>سعر الوحدة</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>${q.productNameAr} <span style="color:#a3a3a3">(${q.productNameEn})</span></td>
        <td class="mono">${q.hsCode}</td>
        <td class="mono">${q.quantitySaleable}</td>
        <td class="mono">${q.incoterm}${q.namedPlace ? " " + q.namedPlace : ""}</td>
        <td class="mono">${q.unitPrice} ${q.currency} / ${q.priceUnit}</td>
      </tr>
    </tbody>
    <tfoot>
      <tr>
        <td colspan="4">الإجمالي التقديري</td>
        <td class="mono price-total">${q.totalValue} ${q.currency}</td>
      </tr>
    </tfoot>
  </table>

  <div class="terms">
    <h3>الشروط</h3>
    <p>شروط الدفع: ${q.paymentTerms ?? "تُحدَّد عند التأكيد"}</p>
    <p>هذا العرض غير ملزم بعد انتهاء صلاحيته، ويخضع لتأكيد الكمية والجودة النهائية وقت الشحن.</p>
  </div>

  <footer>${q.orgLegalName} — تم إنشاء هذا المستند إلكترونيًا عبر منظومة أبوهيبة للتصدير</footer>
</body>
</html>`;
}

function buildQuoteBundleHtml(b: QuoteBundlePdfData): string {
  // إجمالي لكل عملة على حدة — عناصر الحزمة ممكن تكون بعملات مختلفة (نفس العميل بس مش شرط نفس العملة).
  const totalsByCurrency = new Map<string, number>();
  for (const item of b.items) {
    totalsByCurrency.set(item.currency, (totalsByCurrency.get(item.currency) ?? 0) + Number(item.totalValue));
  }
  const totalsHtml = [...totalsByCurrency.entries()].map(([currency, total]) => `${total.toFixed(2)} ${currency}`).join(" + ");

  const rows = b.items
    .map(
      (item) => `
      <tr>
        <td>${item.productNameAr} <span style="color:#a3a3a3">(${item.productNameEn})</span></td>
        <td class="mono">${item.hsCode}</td>
        <td class="mono">${item.quantitySaleable}</td>
        <td class="mono">${item.incoterm}${item.namedPlace ? " " + item.namedPlace : ""}</td>
        <td class="mono">${item.unitPrice} ${item.currency} / ${item.priceUnit}</td>
        <td class="mono">${item.totalValue} ${item.currency}</td>
      </tr>`
    )
    .join("");

  return `<!doctype html>
<html dir="rtl" lang="ar">
<head>
<meta charset="utf-8" />
<style>
  @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap');
  * { box-sizing: border-box; }
  body { font-family: 'IBM Plex Sans Arabic', sans-serif; color: #171717; margin: 0; padding: 40px 48px; font-size: 13px; line-height: 1.6; }
  .mono { font-family: 'IBM Plex Mono', monospace; }
  header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #047857; padding-bottom: 16px; margin-bottom: 24px; }
  .brand { font-size: 20px; font-weight: 700; color: #047857; }
  .brand-sub { font-size: 11px; color: #737373; margin-top: 4px; }
  .doc-title { text-align: left; }
  .doc-title h1 { font-size: 18px; margin: 0; }
  .doc-title p { margin: 4px 0 0; font-size: 11px; color: #737373; }
  .grid { display: flex; gap: 32px; margin-bottom: 24px; }
  .col { flex: 1; }
  .label { font-size: 10px; color: #737373; text-transform: uppercase; letter-spacing: 0.03em; margin-bottom: 2px; }
  .value { font-size: 13px; font-weight: 500; margin-bottom: 10px; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th, td { padding: 10px 12px; text-align: right; font-size: 12px; }
  thead th { background: #f5f5f5; color: #737373; font-weight: 500; font-size: 10px; text-transform: uppercase; border-bottom: 1px solid #e5e5e5; }
  tbody td { border-bottom: 1px solid #f0f0f0; }
  tfoot td { font-weight: 700; font-size: 14px; padding-top: 14px; border-top: 2px solid #171717; }
  .price-total { color: #047857; }
  .terms { margin-top: 28px; padding: 16px; background: #fafafa; border-radius: 8px; font-size: 11px; color: #525252; }
  .terms h3 { font-size: 12px; margin: 0 0 8px; color: #171717; }
  footer { margin-top: 40px; padding-top: 12px; border-top: 1px solid #e5e5e5; font-size: 10px; color: #a3a3a3; text-align: center; }
</style>
</head>
<body>
  <header>
    <div>
      <div class="brand">${b.orgLegalName}</div>
      ${b.orgTaxId ? `<div class="brand-sub">الرقم الضريبي: ${b.orgTaxId}</div>` : ""}
    </div>
    <div class="doc-title">
      <h1>عرض سعر مجمَّع — تصدير</h1>
      <p class="mono">حزمة ${b.bundleId.slice(0, 8)} · ${b.items.length} بند</p>
    </div>
  </header>

  <div class="grid">
    <div class="col">
      <div class="label">إلى (العميل)</div>
      <div class="value">${b.customerLegalName}</div>
      <div class="label">الدولة</div>
      <div class="value">${b.customerCountry}${b.customerCity ? " · " + b.customerCity : ""}</div>
      ${b.contactName ? `<div class="label">عناية</div><div class="value">${b.contactName}</div>` : ""}
    </div>
    <div class="col">
      <div class="label">تاريخ الإصدار</div>
      <div class="value">${fmtDate(b.createdAt)}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>المنتج</th>
        <th>HS Code</th>
        <th>الكمية</th>
        <th>Incoterm</th>
        <th>سعر الوحدة</th>
        <th>الإجمالي</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
    <tfoot>
      <tr>
        <td colspan="5">الإجمالي التقديري</td>
        <td class="mono price-total">${totalsHtml}</td>
      </tr>
    </tfoot>
  </table>

  <div class="terms">
    <h3>الشروط</h3>
    <p>كل بند في المستند ده عرض سعر مستقل بشروطه الخاصة (الكمية/Incoterm/سعر الوحدة) — التجميع هنا للعرض بس.</p>
    <p>هذا العرض غير ملزم بعد انتهاء صلاحيته، ويخضع لتأكيد الكمية والجودة النهائية وقت الشحن.</p>
  </div>

  <footer>${b.orgLegalName} — تم إنشاء هذا المستند إلكترونيًا عبر منظومة أبوهيبة للتصدير</footer>
</body>
</html>`;
}

let browserPromise: ReturnType<typeof puppeteer.launch> | null = null;
function getBrowser() {
  if (!browserPromise) {
    browserPromise = puppeteer.launch({ headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox"] });
  }
  return browserPromise;
}

export async function renderQuotePdf(data: QuotePdfData): Promise<Buffer> {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setContent(buildQuoteHtml(data), { waitUntil: "load" });
    const pdf = await page.pdf({ format: "A4", printBackground: true, margin: { top: "0", bottom: "0", left: "0", right: "0" } });
    return Buffer.from(pdf);
  } finally {
    await page.close();
  }
}

export async function renderQuoteBundlePdf(data: QuoteBundlePdfData): Promise<Buffer> {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setContent(buildQuoteBundleHtml(data), { waitUntil: "load" });
    const pdf = await page.pdf({ format: "A4", printBackground: true, margin: { top: "0", bottom: "0", left: "0", right: "0" } });
    return Buffer.from(pdf);
  } finally {
    await page.close();
  }
}
