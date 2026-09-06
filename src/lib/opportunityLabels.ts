export const OPPORTUNITY_ALL_STAGES = ["NewLead", "Contacted", "Qualified", "QuoteSent", "Won", "Lost"] as const;

export const opportunityStageLabel: Record<string, string> = {
  NewLead: "عميل محتمل جديد",
  Contacted: "تم التواصل",
  Qualified: "مؤهّلة",
  QuoteSent: "تم إرسال عرض",
  Won: "مكسوبة",
  Lost: "خسرانة",
};

export const opportunityStageStyle: Record<string, string> = {
  NewLead: "bg-secondary text-secondary-foreground hover:bg-secondary",
  Contacted: "bg-sky-100 text-sky-700 hover:bg-sky-100",
  Qualified: "bg-amber-100 text-amber-700 hover:bg-amber-100",
  QuoteSent: "bg-indigo-100 text-indigo-700 hover:bg-indigo-100",
  Won: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  Lost: "bg-rose-100 text-rose-700 hover:bg-rose-100",
};

/** الأزواج المسموح بيها بس — تدفّق حقيقي بدل تعديل حالة حر (نفس فلسفة CAPA_STATUS_TRANSITIONS).
 * Won بس من QuoteSent (لازم عرض سعر يتبعت الأول)، Lost ممكنة من أي مرحلة نشطة (صفقة ممكن
 * تتخسر في أي وقت). الانتقال لـQuoteSent نفسه ليه Trigger على مستوى القاعدة
 * (enforce_opportunity_rfq_before_quote) بيمنعه بلا RFQAnalysis واحد على الأقل مسجَّل. */
export const OPPORTUNITY_STAGE_TRANSITIONS: Record<string, string[]> = {
  NewLead: ["Contacted", "Lost"],
  Contacted: ["Qualified", "Lost"],
  Qualified: ["QuoteSent", "Lost"],
  QuoteSent: ["Won", "Lost"],
  Won: [],
  Lost: [],
};
