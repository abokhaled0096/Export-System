import { Resend } from "resend";

/** بيرجع false لو RESEND_API_KEY مش متظبط — الميزة بتتقفل بأمان بدل ما تكراش. */
export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

/** المرسل الافتراضي — لازم يبقى دومين متحقّق منه في Resend قبل الإنتاج. راجع STATUS.md. */
const FROM_ADDRESS = process.env.RESEND_FROM_ADDRESS || "quotes@elheibaland.com";

export async function sendQuoteEmailMessage(params: {
  to: string;
  customerName: string;
  productNameAr: string;
  quoteVersion: number;
  pdfBuffer: Buffer;
  pdfFilename: string;
}) {
  const resend = new Resend(process.env.RESEND_API_KEY);
  return resend.emails.send({
    from: FROM_ADDRESS,
    to: params.to,
    subject: `عرض سعر — ${params.productNameAr} (v${params.quoteVersion})`,
    html: `<div dir="rtl" style="font-family: sans-serif;">
      <p>السادة ${params.customerName}،</p>
      <p>مرفق عرض السعر الخاص بـ${params.productNameAr}.</p>
      <p>لأي استفسار، برجاء الرد على هذا الإيميل.</p>
      <p>مع تحيات فريق ELHEIBALAND EXPORT</p>
      <p style="color:#C9A7B8;font-size:11px;letter-spacing:2px;text-transform:uppercase;">From Egypt to the World with Trust</p>
    </div>`,
    attachments: [{ filename: params.pdfFilename, content: params.pdfBuffer }],
  });
}
