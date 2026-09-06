export const invoiceTypeLabel: Record<string, string> = {
  SalesInvoice: "فاتورة مبيعات",
  PurchaseInvoice: "فاتورة مشتريات",
  CreditNote: "إشعار دائن",
  DebitNote: "إشعار مدين",
  ProformaInvoice: "فاتورة أولية",
};

export const invoiceStatusLabel: Record<string, string> = {
  Draft: "مسودة",
  Issued: "مُصدَرة",
  PartiallyPaid: "مدفوعة جزئيًا",
  Paid: "مدفوعة",
  Overdue: "متأخرة",
  Disputed: "متنازع عليها",
  Cancelled: "ملغاة",
};

export const invoiceStatusStyle: Record<string, string> = {
  Draft: "bg-secondary text-secondary-foreground hover:bg-secondary",
  Issued: "bg-sky-100 text-sky-700 hover:bg-sky-100",
  PartiallyPaid: "bg-amber-100 text-amber-700 hover:bg-amber-100",
  Paid: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  Overdue: "bg-rose-100 text-rose-700 hover:bg-rose-100",
  Disputed: "bg-rose-100 text-rose-700 hover:bg-rose-100",
  Cancelled: "bg-secondary text-secondary-foreground hover:bg-secondary",
};

export const paymentDirectionLabel: Record<string, string> = {
  Inbound: "وارد (تحصيل)",
  Outbound: "صادر (سداد)",
};

export const paymentMethodLabel: Record<string, string> = {
  BankTransfer: "تحويل بنكي",
  Check: "شيك",
  Cash: "نقدي",
  LC: "اعتماد مستندي",
  Card: "بطاقة",
};

export const paymentStatusLabel: Record<string, string> = {
  Pending: "معلّقة",
  Cleared: "محصّلة",
  Bounced: "مرتدّة",
  Reversed: "معكوسة",
};

export const paymentStatusStyle: Record<string, string> = {
  Pending: "bg-amber-100 text-amber-700 hover:bg-amber-100",
  Cleared: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  Bounced: "bg-rose-100 text-rose-700 hover:bg-rose-100",
  Reversed: "bg-secondary text-secondary-foreground hover:bg-secondary",
};

/** الفاتورة متأخرة = مُصدَرة/مدفوعة جزئيًا + تاريخ الاستحقاق عدّى. حالة زمنية بتتحسب وقت العرض
 * مش مخزَّنة (أي حالة زمنية مخزَّنة بتبقى قديمة لحظة ما بتتكتب بلا حدث يحدّثها). */
export function isInvoiceOverdue(status: string, dueDate: Date): boolean {
  if (status !== "Issued" && status !== "PartiallyPaid") return false;
  return dueDate.getTime() < Date.now();
}

/** عدد أيام التأخير (0 لو مش متأخرة) — أساس شرائح تقرير أعمار الديون. */
export function daysOverdue(dueDate: Date): number {
  const diff = Date.now() - dueDate.getTime();
  return diff <= 0 ? 0 : Math.floor(diff / 86_400_000);
}
