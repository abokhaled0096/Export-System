export const customerServiceCaseTypeLabel: Record<string, string> = {
  Complaint: "شكوى",
  Claim: "مطالبة",
  QualityIssue: "مشكلة جودة",
  Shortage: "نقص كمية",
  Damage: "تلف",
  LateShipment: "تأخّر شحن",
  WrongDocumentation: "مستندات خاطئة",
};

export const customerServiceCaseStatusLabel: Record<string, string> = {
  Open: "مفتوحة",
  Investigating: "قيد التحقيق",
  PendingCustomer: "بانتظار العميل",
  Resolved: "اتحلّت",
  Closed: "مقفولة",
};

export const customerServiceCaseStatusStyle: Record<string, string> = {
  Open: "bg-rose-100 text-rose-700 hover:bg-rose-100",
  Investigating: "bg-amber-100 text-amber-700 hover:bg-amber-100",
  PendingCustomer: "bg-sky-100 text-sky-700 hover:bg-sky-100",
  Resolved: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  Closed: "bg-secondary text-secondary-foreground hover:bg-secondary",
};
