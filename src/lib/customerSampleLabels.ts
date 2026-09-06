export const customerSampleStatusLabel: Record<string, string> = {
  Requested: "مطلوبة",
  ApprovedInternally: "معتمدة داخليًا",
  Preparing: "قيد التجهيز",
  Shipped: "اترسلت",
  InTransit: "في الطريق",
  Delivered: "اتسلّمت",
  FeedbackPending: "بانتظار الملاحظات",
  Approved: "معتمدة",
  Rejected: "مرفوضة",
  ConvertedToOrder: "اتحوّلت لأوردر",
  Closed: "مقفولة",
};

export const customerSampleStatusStyle: Record<string, string> = {
  Requested: "bg-secondary text-secondary-foreground hover:bg-secondary",
  ApprovedInternally: "bg-sky-100 text-sky-700 hover:bg-sky-100",
  Preparing: "bg-sky-100 text-sky-700 hover:bg-sky-100",
  Shipped: "bg-sky-100 text-sky-700 hover:bg-sky-100",
  InTransit: "bg-sky-100 text-sky-700 hover:bg-sky-100",
  Delivered: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  FeedbackPending: "bg-amber-100 text-amber-700 hover:bg-amber-100",
  Approved: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  Rejected: "bg-rose-100 text-rose-700 hover:bg-rose-100",
  ConvertedToOrder: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  Closed: "bg-secondary text-secondary-foreground hover:bg-secondary",
};
