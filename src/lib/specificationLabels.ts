export const productSpecificationStatusLabel: Record<string, string> = {
  Draft: "مسودة",
  InternalReview: "مراجعة داخلية",
  CustomerReview: "مراجعة العميل",
  CustomerApproved: "معتمدة من العميل",
  QualityApproved: "معتمدة جودة",
  Superseded: "استُبدلت",
  Expired: "منتهية",
};

export const productSpecificationStatusStyle: Record<string, string> = {
  Draft: "bg-secondary text-secondary-foreground hover:bg-secondary",
  InternalReview: "bg-amber-100 text-amber-700 hover:bg-amber-100",
  CustomerReview: "bg-amber-100 text-amber-700 hover:bg-amber-100",
  CustomerApproved: "bg-sky-100 text-sky-700 hover:bg-sky-100",
  QualityApproved: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  Superseded: "bg-secondary text-secondary-foreground hover:bg-secondary",
  Expired: "bg-rose-100 text-rose-700 hover:bg-rose-100",
};
