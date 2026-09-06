export const accountTypeLabel: Record<string, string> = {
  Asset: "أصول",
  Liability: "خصوم",
  Equity: "حقوق ملكية",
  Revenue: "إيرادات",
  COGS: "تكلفة المبيعات",
  Expense: "مصروفات",
};

export const normalBalanceLabel: Record<string, string> = {
  Debit: "مدين",
  Credit: "دائن",
};

export const accountingPeriodStatusLabel: Record<string, string> = {
  Open: "مفتوحة",
  SoftClosed: "مقفولة مبدئيًا",
  HardClosed: "مقفولة نهائيًا",
};

export const accountingPeriodStatusStyle: Record<string, string> = {
  Open: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  SoftClosed: "bg-amber-100 text-amber-700 hover:bg-amber-100",
  HardClosed: "bg-rose-100 text-rose-700 hover:bg-rose-100",
};

export const journalEntrySourceTypeLabel: Record<string, string> = {
  Manual: "يدوي",
  Automatic: "تلقائي",
  Recurring: "متكرّر",
  Reversal: "عكسي",
  Accrual: "استحقاق",
  Adjustment: "تسوية",
};

export const journalEntryStatusLabel: Record<string, string> = {
  Draft: "مسودة",
  Posted: "مرحّل",
  Reversed: "معكوس",
};

export const journalEntryStatusStyle: Record<string, string> = {
  Draft: "bg-secondary text-secondary-foreground hover:bg-secondary",
  Posted: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  Reversed: "bg-rose-100 text-rose-700 hover:bg-rose-100",
};

export const costCenterTypeLabel: Record<string, string> = {
  Department: "قسم",
  Product: "منتج",
  Customer: "عميل",
  Deal: "صفقة",
  Market: "سوق",
};

export const profitCenterScopeLabel: Record<string, string> = {
  Company: "الشركة",
  Division: "قطاع",
  Product: "منتج",
  Market: "سوق",
};
