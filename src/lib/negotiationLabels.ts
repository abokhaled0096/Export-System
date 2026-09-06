export const negotiationStatusLabel: Record<string, string> = {
  Open: "مفتوح",
  Stalled: "متوقّف",
  Agreed: "اتفاق",
  Failed: "فشل",
};

export const negotiationStatusStyle: Record<string, string> = {
  Open: "bg-sky-100 text-sky-700 hover:bg-sky-100",
  Stalled: "bg-amber-100 text-amber-700 hover:bg-amber-100",
  Agreed: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  Failed: "bg-rose-100 text-rose-700 hover:bg-rose-100",
};

export const negotiationConcessionTypeLabel: Record<string, string> = {
  Discount: "خصم",
  Credit: "أجل دفع",
  LowerAdvance: "دفعة مقدّمة أقل",
  SpecialPackaging: "تغليف خاص",
  PrivateLabel: "علامة خاصة",
  FasterShipping: "شحن أسرع",
  Exclusivity: "حصرية",
  FreeSample: "عينة مجانية",
  LowerMOQ: "حد أدنى طلب أقل",
};
