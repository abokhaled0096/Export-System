export const clauseCategoryLabel: Record<string, string> = {
  Payment: "دفع",
  Delivery: "تسليم",
  Quality: "جودة",
  Claims: "مطالبات",
  ForceMajeure: "قوة قاهرة",
  GoverningLaw: "القانون الحاكم",
  Confidentiality: "سرّية",
  Cancellation: "إلغاء",
};

export const clauseRiskLevelLabel: Record<string, string> = {
  Low: "منخفضة",
  Medium: "متوسطة",
  High: "عالية",
};

export const clauseRiskLevelStyle: Record<string, string> = {
  Low: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  Medium: "bg-amber-100 text-amber-700 hover:bg-amber-100",
  High: "bg-rose-100 text-rose-700 hover:bg-rose-100",
};
