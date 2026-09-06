export const documentPackageTypeLabel: Record<string, string> = {
  QuotationPack: "حزمة عرض سعر",
  FirstOrderPack: "حزمة أول أوردر",
  ShipmentPack: "حزمة شحنة",
  SamplePack: "حزمة عينة",
  TenderPack: "حزمة مناقصة",
};

export const documentPackageStatusLabel: Record<string, string> = {
  NotStarted: "لسه ما بدأش",
  InProgress: "قيد التجهيز",
  MissingData: "بيانات ناقصة",
  UnderReview: "قيد المراجعة",
  Complete: "مكتملة",
  Issued: "صادرة",
  Sent: "اترسلت",
};

export const documentPackageStatusStyle: Record<string, string> = {
  NotStarted: "bg-secondary text-secondary-foreground hover:bg-secondary",
  InProgress: "bg-sky-100 text-sky-700 hover:bg-sky-100",
  MissingData: "bg-rose-100 text-rose-700 hover:bg-rose-100",
  UnderReview: "bg-amber-100 text-amber-700 hover:bg-amber-100",
  Complete: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  Issued: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  Sent: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
};
