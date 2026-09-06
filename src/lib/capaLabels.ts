export const capaRootCauseMethodLabel: Record<string, string> = {
  FiveWhys: "الأسباب الخمسة (5 Whys)",
  Fishbone: "مخطط عظمة السمكة",
  Other: "أخرى",
};

export const capaStatusLabel: Record<string, string> = {
  Open: "مفتوح",
  InProgress: "قيد التنفيذ",
  VerificationPending: "بانتظار التحقق",
  Effective: "فعّال",
  Ineffective: "غير فعّال",
  Closed: "مغلق",
  Overdue: "متأخّر",
};

export const capaStatusStyle: Record<string, string> = {
  Open: "bg-secondary text-secondary-foreground hover:bg-secondary",
  InProgress: "bg-sky-100 text-sky-700 hover:bg-sky-100",
  VerificationPending: "bg-amber-100 text-amber-700 hover:bg-amber-100",
  Effective: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  Ineffective: "bg-rose-100 text-rose-700 hover:bg-rose-100",
  Closed: "bg-secondary text-secondary-foreground hover:bg-secondary",
  Overdue: "bg-rose-100 text-rose-700 hover:bg-rose-100",
};

/** الأزواج المسموح بيها بس — تدفّق حقيقي بدل تعديل حالة حر. */
export const CAPA_STATUS_TRANSITIONS: Record<string, string[]> = {
  Open: ["InProgress", "VerificationPending"],
  InProgress: ["VerificationPending"],
  VerificationPending: ["Effective", "Ineffective"],
  Effective: ["Closed"],
  Ineffective: ["Closed"],
  Closed: [],
};

/** "متأخر" محسوب من dueDate وقت العرض — مش status مخزَّن (نفس علاج Invoice.Overdue/
 * LoanInstallment.Overdue، ومفروض كمان بـTrigger enforce_capa_verification على مستوى القاعدة). */
export function isCAPAOverdue(status: string, dueDate: Date | null): boolean {
  if (!dueDate) return false;
  if (status === "Closed" || status === "Effective") return false;
  return dueDate.getTime() < Date.now();
}
