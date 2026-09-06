export const documentTypeLabel: Record<string, string> = {
  Quotation: "عرض سعر",
  ProformaInvoice: "فاتورة أولية",
  CommercialInvoice: "فاتورة تجارية",
  PackingList: "قائمة تعبئة",
  SalesContract: "عقد بيع",
  SalesConfirmation: "تأكيد بيع",
  TechnicalDataSheet: "نشرة فنية",
  COA: "شهادة تحليل (COA)",
  Declaration: "إقرار",
  PriceList: "قائمة أسعار",
  EmailDraft: "مسودة إيميل",
};

export const documentLanguageLabel: Record<string, string> = {
  Arabic: "عربي",
  English: "إنجليزي",
  Bilingual: "ثنائي اللغة",
};

export const documentStatusLabel: Record<string, string> = {
  Draft: "مسودة",
  Incomplete: "غير مكتمل",
  UnderReview: "قيد المراجعة",
  RevisionRequired: "يحتاج تعديل",
  Approved: "معتمد",
  Issued: "مُصدَر",
  Sent: "اترسل",
  Acknowledged: "اتأكّد استلامه",
  Superseded: "استُبدل",
  Expired: "منتهي",
  Cancelled: "ملغى",
};

export const documentStatusStyle: Record<string, string> = {
  Draft: "bg-secondary text-secondary-foreground hover:bg-secondary",
  Incomplete: "bg-amber-100 text-amber-700 hover:bg-amber-100",
  UnderReview: "bg-amber-100 text-amber-700 hover:bg-amber-100",
  RevisionRequired: "bg-rose-100 text-rose-700 hover:bg-rose-100",
  Approved: "bg-sky-100 text-sky-700 hover:bg-sky-100",
  Issued: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  Sent: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  Acknowledged: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  Superseded: "bg-secondary text-secondary-foreground hover:bg-secondary",
  Expired: "bg-rose-100 text-rose-700 hover:bg-rose-100",
  Cancelled: "bg-secondary text-secondary-foreground hover:bg-secondary",
};

export const documentEtaStatusLabel: Record<string, string> = {
  NotApplicable: "غير منطبق",
  Pending: "قيد الانتظار",
  Submitted: "اترسل",
  Validated: "معتمد",
  Rejected: "مرفوض",
};

export const documentEtaStatusStyle: Record<string, string> = {
  NotApplicable: "bg-secondary text-secondary-foreground hover:bg-secondary",
  Pending: "bg-amber-100 text-amber-700 hover:bg-amber-100",
  Submitted: "bg-sky-100 text-sky-700 hover:bg-sky-100",
  Validated: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  Rejected: "bg-rose-100 text-rose-700 hover:bg-rose-100",
};
