export const commissionBasisLabel: Record<string, string> = {
  RevenuePercent: "نسبة من الإيراد",
  GrossProfitPercent: "نسبة من إجمالي الربح",
  Tiered: "متدرّج",
  CollectionBased: "على أساس التحصيل",
};

export const commissionTriggerEventLabel: Record<string, string> = {
  OnWon: "عند كسب الصفقة",
  OnInvoice: "عند الفوترة",
  OnCollection: "عند التحصيل",
};

export const commissionEntryStatusLabel: Record<string, string> = {
  Accrued: "مستحقّة",
  Approved: "معتمدة",
  Paid: "مدفوعة",
};

export const commissionEntryStatusStyle: Record<string, string> = {
  Accrued: "bg-secondary text-secondary-foreground hover:bg-secondary",
  Approved: "bg-sky-100 text-sky-700 hover:bg-sky-100",
  Paid: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
};
