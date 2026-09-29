import { renderHtmlToPdf } from "@/lib/pdf-browser";

/**
 * الفاتورة التجارية (Commercial Invoice) — المستند اللي بيتقدّم للجمارك وللبنك وللعميل.
 *
 * المحتوى مش اختيار تصميمي: الفاتورة التجارية للتصدير لازم يبقى فيها لكل بند **وصف وكود HS
 * وبلد منشأ وكمية ووحدة وسعر وحدة**، وإجمالي بالأرقام والحروف، وشرط تسليم (Incoterm)، وبيان
 * إقرار بصحة البيانات. من غير دول المستند بيترفض. ده السبب اللي `InvoiceLine` اتبنى عشانه
 * من الأساس (هجرة 20260929100000) — والملف ده هو اللي بيوصّل الفايدة دي للمستخدم فعليًا.
 *
 * ثنائي اللغة (عربي/إنجليزي) عن قصد: الجمارك المصرية بتقرا العربي، والمستورد الأجنبي
 * والبنك المراسل بيقروا الإنجليزي. مستند واحد بيخدم الاتنين أحسن من اتنين بيختلفوا.
 */

export type InvoicePdfLine = {
  lineNumber: number;
  description: string;
  hsCode: string | null;
  countryOfOrigin: string | null;
  quantity: string;
  unit: string;
  unitPrice: string;
  lineTotal: string;
  netWeightKg: string | null;
  grossWeightKg: string | null;
};

export type InvoicePdfData = {
  orgLegalName: string;
  orgTaxId: string | null;
  invoiceNumber: string;
  invoiceTypeAr: string;
  invoiceTypeEn: string;
  status: string;
  issueDate: Date;
  dueDate: Date;
  currency: string;
  subtotal: string;
  taxAmount: string;
  totalAmount: string;
  totalInWords: string;
  /** المشتري — شركة في فاتورة مبيعات، مورّد في فاتورة مشتريات. */
  partyName: string;
  partyCountry: string | null;
  incoterm: string | null;
  namedPlace: string | null;
  paymentTerms: string | null;
  soNumber: string | null;
  etaDocumentNumber: string | null;
  notes: string | null;
  lines: InvoicePdfLine[];
  totalNetWeight: string | null;
  totalGrossWeight: string | null;
};

function esc(v: string | null | undefined): string {
  if (v === null || v === undefined) return "";
  return v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function fmtDate(d: Date): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Cairo", day: "2-digit", month: "2-digit", year: "numeric" }).format(d);
}

/** مُصدَّرة عشان تنفع معاينة/اختبار من غير ما نشغّل Chromium. */
export function buildInvoiceHtml(v: InvoicePdfData): string {
  const rows = v.lines
    .map(
      (l) => `
      <tr>
        <td class="mono">${l.lineNumber}</td>
        <td>${esc(l.description)}</td>
        <td class="mono">${esc(l.hsCode) || "—"}</td>
        <td>${esc(l.countryOfOrigin) || "—"}</td>
        <td class="mono num">${esc(l.quantity)}</td>
        <td>${esc(l.unit)}</td>
        <td class="mono num">${esc(l.unitPrice)}</td>
        <td class="mono num strong">${esc(l.lineTotal)}</td>
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
  body {
    font-family: 'IBM Plex Sans Arabic', sans-serif;
    /* ⚠️ الخلفية واللون صريحين، و color-scheme: light مقفولة: من غيرهم المستند بيورِث
       الوضع الداكن من المتصفح/القارئ ويطلع أبيض على أسود. مستند جمركي بيتطبع كده = كارثة. */
    background: #ffffff;
    color-scheme: light;
    color: #171717; margin: 0; padding: 36px 44px; font-size: 12px; line-height: 1.55;
  }
  .mono { font-family: 'IBM Plex Mono', monospace; }
  .num { text-align: left; direction: ltr; }
  .strong { font-weight: 600; }
  header {
    display: flex; justify-content: space-between; align-items: flex-start;
    border-bottom: 3px solid #7A0F3D; padding-bottom: 14px; margin-bottom: 18px;
  }
  .brand { font-size: 19px; font-weight: 700; color: #7A0F3D; letter-spacing: 0.5px; }
  .brand-sub { font-size: 10px; color: #737373; margin-top: 3px; }
  .doc-title { text-align: left; }
  .doc-title h1 { font-size: 17px; margin: 0; color: #3B0F2F; }
  .doc-title .en { font-size: 11px; color: #737373; margin: 2px 0 0; letter-spacing: 0.06em; text-transform: uppercase; }
  .doc-title .no { font-size: 14px; margin-top: 6px; font-weight: 600; }
  .draft {
    display: inline-block; margin-top: 6px; padding: 3px 10px; border-radius: 999px;
    font-size: 10px; font-weight: 700; background: #fef3c7; color: #92400e;
  }
  .grid { display: flex; gap: 28px; margin-bottom: 16px; }
  .col { flex: 1; }
  .box { border: 1px solid #e5e5e5; border-radius: 8px; padding: 10px 12px; height: 100%; }
  .label { font-size: 9px; color: #737373; letter-spacing: 0.06em; text-transform: uppercase; margin-bottom: 1px; }
  .value { font-size: 12px; font-weight: 500; margin-bottom: 7px; }
  .value:last-child { margin-bottom: 0; }
  table { width: 100%; border-collapse: collapse; margin-top: 6px; }
  th, td { padding: 7px 8px; text-align: right; font-size: 11px; vertical-align: top; }
  thead th {
    background: #f5f5f5; color: #525252; font-weight: 600; font-size: 9px;
    letter-spacing: 0.04em; text-transform: uppercase; border-bottom: 1px solid #d4d4d4;
  }
  tbody td { border-bottom: 1px solid #f0f0f0; }
  tbody tr:nth-child(even) td { background: #fcfbfb; }
  .totals { margin-top: 12px; display: flex; justify-content: flex-start; }
  .totals table { width: 280px; }
  .totals td { padding: 5px 8px; font-size: 12px; border: none; }
  .totals tr.grand td { border-top: 2px solid #171717; font-size: 14px; font-weight: 700; color: #7A0F3D; padding-top: 9px; }
  .words { margin-top: 10px; padding: 9px 12px; background: #FAF7F4; border-radius: 8px; font-size: 11px; }
  .words .label { margin-bottom: 2px; }
  .declaration { margin-top: 18px; padding: 11px 13px; background: #fafafa; border-radius: 8px; font-size: 10px; color: #525252; }
  .declaration .en { margin-top: 4px; direction: ltr; text-align: left; }
  .sign { margin-top: 26px; display: flex; justify-content: space-between; gap: 40px; }
  .sign div { flex: 1; border-top: 1px solid #a3a3a3; padding-top: 6px; font-size: 10px; color: #737373; }
  footer {
    margin-top: 26px; padding-top: 10px; border-top: 1px solid #e5e5e5;
    font-size: 9px; color: #a3a3a3; text-align: center;
  }
</style>
</head>
<body>
  <header>
    <div>
      <div class="brand">${esc(v.orgLegalName)}</div>
      <div class="brand-sub">From Egypt to the World with Trust</div>
      ${v.orgTaxId ? `<div class="brand-sub">الرقم الضريبي / Tax ID: <span class="mono">${esc(v.orgTaxId)}</span></div>` : ""}
    </div>
    <div class="doc-title">
      <h1>${esc(v.invoiceTypeAr)}</h1>
      <p class="en">${esc(v.invoiceTypeEn)}</p>
      <p class="no mono">${esc(v.invoiceNumber)}</p>
      ${v.status === "Draft" ? `<span class="draft">مسودة — غير صالحة للتقديم / DRAFT</span>` : ""}
    </div>
  </header>

  <div class="grid">
    <div class="col">
      <div class="box">
        <div class="label">المستورد / Consignee</div>
        <div class="value">${esc(v.partyName)}</div>
        <div class="label">الدولة / Country</div>
        <div class="value">${esc(v.partyCountry) || "—"}</div>
      </div>
    </div>
    <div class="col">
      <div class="box">
        <div class="label">تاريخ الإصدار / Issue date</div>
        <div class="value mono">${fmtDate(v.issueDate)}</div>
        <div class="label">تاريخ الاستحقاق / Due date</div>
        <div class="value mono">${fmtDate(v.dueDate)}</div>
        ${v.soNumber ? `<div class="label">أمر البيع / Sales order</div><div class="value mono">${esc(v.soNumber)}</div>` : ""}
      </div>
    </div>
    <div class="col">
      <div class="box">
        <div class="label">شرط التسليم / Incoterm</div>
        <div class="value">${esc(v.incoterm) || "—"}${v.namedPlace ? ` — ${esc(v.namedPlace)}` : ""}</div>
        <div class="label">شروط الدفع / Payment terms</div>
        <div class="value">${esc(v.paymentTerms) || "—"}</div>
        ${
          v.etaDocumentNumber
            ? `<div class="label">المستند الإلكتروني / ETA</div><div class="value mono">${esc(v.etaDocumentNumber)}</div>`
            : ""
        }
      </div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width:26px">#</th>
        <th>الصنف / Description</th>
        <th style="width:72px">HS Code</th>
        <th style="width:78px">المنشأ / Origin</th>
        <th style="width:72px">الكمية</th>
        <th style="width:52px">الوحدة</th>
        <th style="width:78px">سعر الوحدة</th>
        <th style="width:88px">الإجمالي</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <div class="totals">
    <table>
      <tr><td>الصافي / Subtotal</td><td class="mono num">${esc(v.subtotal)} ${esc(v.currency)}</td></tr>
      <tr><td>ض.ق.م / VAT</td><td class="mono num">${esc(v.taxAmount)} ${esc(v.currency)}</td></tr>
      <tr class="grand"><td>الإجمالي / Total</td><td class="mono num">${esc(v.totalAmount)} ${esc(v.currency)}</td></tr>
    </table>
  </div>

  <div class="words">
    <div class="label">الإجمالي كتابةً / Amount in words</div>
    <div>${esc(v.totalInWords)}</div>
  </div>

  ${
    v.totalNetWeight || v.totalGrossWeight
      ? `<div class="words">
          <div class="label">الأوزان / Weights</div>
          <div class="mono">
            ${v.totalNetWeight ? `الوزن الصافي / Net: ${esc(v.totalNetWeight)} kg` : ""}
            ${v.totalNetWeight && v.totalGrossWeight ? " · " : ""}
            ${v.totalGrossWeight ? `الوزن القائم / Gross: ${esc(v.totalGrossWeight)} kg` : ""}
          </div>
        </div>`
      : ""
  }

  ${v.notes ? `<div class="words"><div class="label">ملاحظات / Notes</div><div>${esc(v.notes)}</div></div>` : ""}

  <div class="declaration">
    نقرّ بأن البيانات الواردة في هذه الفاتورة صحيحة، وأن البضاعة المذكورة أعلاه منشؤها جمهورية مصر العربية ما لم يُذكر غير ذلك.
    <div class="en">
      We hereby certify that the information on this invoice is true and correct, and that the goods described herein
      originate in the Arab Republic of Egypt unless otherwise stated.
    </div>
  </div>

  <div class="sign">
    <div>التوقيع المعتمد / Authorized signature</div>
    <div>الختم / Company stamp</div>
  </div>

  <footer>
    ${esc(v.orgLegalName)} · ${esc(v.invoiceNumber)} · صدرت في ${fmtDate(v.issueDate)}
  </footer>
</body>
</html>`;
}

export async function renderInvoicePdf(data: InvoicePdfData): Promise<Buffer> {
  return renderHtmlToPdf(buildInvoiceHtml(data));
}
