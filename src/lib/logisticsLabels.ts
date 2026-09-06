// تسميات عربية موحّدة لكل enums وحدة 6 (اللوجستيات) — مشتركة بين كل شاشات /logistics
// عشان محدش يكرر نفس الخرائط في كل ملف. راجع docs/ERD.md §9.

export const shipmentTypeLabel: Record<string, string> = {
  Commercial: "تجارية",
  Sample: "عيّنة",
  Trial: "تجريبية",
  Tender: "مناقصة",
  Consolidated: "مجمّعة",
};

export const transportModeLabel: Record<string, string> = {
  Sea: "بحري",
  Air: "جوي",
  Road: "بري",
  Rail: "سكك حديدية",
  Multimodal: "متعدد الوسائط",
  Courier: "بريد سريع",
};

export const loadTypeLabel: Record<string, string> = {
  FCL: "حاوية كاملة (FCL)",
  LCL: "حمولة مجمّعة (LCL)",
};

export const shipmentStatusLabel: Record<string, string> = {
  Draft: "مسودة",
  Planning: "تخطيط",
  AwaitingRates: "بانتظار أسعار الشحن",
  BookingRequested: "طلب حجز",
  BookingConfirmed: "حجز مؤكّد",
  CargoPreparation: "تجهيز البضاعة",
  Loading: "تحميل",
  CustomsClearance: "تخليص جمركي",
  GateIn: "دخول الميناء",
  Departed: "غادرت",
  InTransit: "في الطريق",
  Transshipment: "شحن عابر",
  Arrived: "وصلت",
  CustomsHold: "محجوزة جمركيًا",
  Clearance: "تخليص",
  OutForDelivery: "خارجة للتسليم",
  Delivered: "تم التسليم",
  EmptyReturned: "إرجاع الحاوية الفارغة",
  Closed: "مقفولة",
  Cancelled: "ملغاة",
  Exception: "استثناء",
};

export const shipmentStatusStyle: Record<string, string> = {
  Draft: "bg-secondary text-secondary-foreground hover:bg-secondary",
  Planning: "bg-sky-100 text-sky-700 hover:bg-sky-100",
  AwaitingRates: "bg-sky-100 text-sky-700 hover:bg-sky-100",
  BookingRequested: "bg-sky-100 text-sky-700 hover:bg-sky-100",
  BookingConfirmed: "bg-sky-100 text-sky-700 hover:bg-sky-100",
  CargoPreparation: "bg-amber-100 text-amber-700 hover:bg-amber-100",
  Loading: "bg-amber-100 text-amber-700 hover:bg-amber-100",
  CustomsClearance: "bg-amber-100 text-amber-700 hover:bg-amber-100",
  GateIn: "bg-amber-100 text-amber-700 hover:bg-amber-100",
  Departed: "bg-sky-100 text-sky-700 hover:bg-sky-100",
  InTransit: "bg-sky-100 text-sky-700 hover:bg-sky-100",
  Transshipment: "bg-sky-100 text-sky-700 hover:bg-sky-100",
  Arrived: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  CustomsHold: "bg-rose-100 text-rose-700 hover:bg-rose-100",
  Clearance: "bg-amber-100 text-amber-700 hover:bg-amber-100",
  OutForDelivery: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  Delivered: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  EmptyReturned: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  Closed: "bg-secondary text-secondary-foreground hover:bg-secondary",
  Cancelled: "bg-secondary text-secondary-foreground hover:bg-secondary",
  Exception: "bg-rose-100 text-rose-700 hover:bg-rose-100",
};

export const aciStatusLabel: Record<string, string> = {
  NotRequired: "غير مطلوب",
  Pending: "قيد الإعداد",
  Submitted: "تم التقديم",
  Approved: "معتمد",
  Rejected: "مرفوض",
};

export const aciStatusStyle: Record<string, string> = {
  NotRequired: "bg-secondary text-secondary-foreground hover:bg-secondary",
  Pending: "bg-amber-100 text-amber-700 hover:bg-amber-100",
  Submitted: "bg-sky-100 text-sky-700 hover:bg-sky-100",
  Approved: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  Rejected: "bg-rose-100 text-rose-700 hover:bg-rose-100",
};

export const partyRoleLabel: Record<string, string> = {
  Buyer: "المشتري",
  Consignee: "المرسل إليه",
  NotifyParty: "طرف الإخطار",
  ImporterOfRecord: "المستورد المسجَّل",
  CustomsBroker: "المخلّص الجمركي",
};

export const bookingStatusLabel: Record<string, string> = {
  Draft: "مسودة",
  Requested: "مطلوب",
  Pending: "قيد الانتظار",
  Confirmed: "مؤكّد",
  Amended: "مُعدَّل",
  Rolled: "مؤجَّل لرحلة تالية",
  Split: "مقسَّم",
  Cancelled: "ملغى",
  Expired: "منتهي",
  Completed: "مكتمل",
};

export const bookingStatusStyle: Record<string, string> = {
  Draft: "bg-secondary text-secondary-foreground hover:bg-secondary",
  Requested: "bg-sky-100 text-sky-700 hover:bg-sky-100",
  Pending: "bg-amber-100 text-amber-700 hover:bg-amber-100",
  Confirmed: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  Amended: "bg-amber-100 text-amber-700 hover:bg-amber-100",
  Rolled: "bg-rose-100 text-rose-700 hover:bg-rose-100",
  Split: "bg-amber-100 text-amber-700 hover:bg-amber-100",
  Cancelled: "bg-secondary text-secondary-foreground hover:bg-secondary",
  Expired: "bg-secondary text-secondary-foreground hover:bg-secondary",
  Completed: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
};

export const containerTypeLabel: Record<string, string> = {
  GP20: "20 قدم عام",
  GP40: "40 قدم عام",
  HC40: "40 قدم مرتفع",
  RF20: "20 قدم مبرّد",
  RF40: "40 قدم مبرّد",
  HCRF40: "40 قدم مبرّد مرتفع",
  OpenTop: "سقف مفتوح",
  FlatRack: "منصة مسطّحة",
  Tank: "خزّان",
};

export const milestoneStatusLabel: Record<string, string> = {
  NotStarted: "لم تبدأ",
  Planned: "مخطَّطة",
  InProgress: "جارية",
  Completed: "مكتملة",
  Delayed: "متأخّرة",
  Missed: "فائتة",
  Blocked: "محجوبة",
  NotApplicable: "غير منطبقة",
};

export const milestoneStatusStyle: Record<string, string> = {
  NotStarted: "bg-secondary text-secondary-foreground hover:bg-secondary",
  Planned: "bg-sky-100 text-sky-700 hover:bg-sky-100",
  InProgress: "bg-amber-100 text-amber-700 hover:bg-amber-100",
  Completed: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  Delayed: "bg-rose-100 text-rose-700 hover:bg-rose-100",
  Missed: "bg-rose-100 text-rose-700 hover:bg-rose-100",
  Blocked: "bg-rose-100 text-rose-700 hover:bg-rose-100",
  NotApplicable: "bg-secondary text-secondary-foreground hover:bg-secondary",
};

export const shipmentEventSourceLabel: Record<string, string> = {
  Manual: "يدوي",
  ShippingLineWebsite: "موقع شركة الشحن",
  FreightForwarder: "وكيل الشحن",
  Port: "الميناء",
  CustomsBroker: "المخلّص الجمركي",
  Customer: "العميل",
  ImportedCSV: "استيراد CSV",
  API: "API",
};

export const logisticsExceptionTypeLabel: Record<string, string> = {
  BookingRejected: "رفض حجز",
  ContainerShortage: "نقص حاويات",
  TruckDelay: "تأخر شاحنة",
  LoadingDelay: "تأخر تحميل",
  CustomsHold: "حجز جمركي",
  DocumentationError: "خطأ مستندات",
  VGMError: "خطأ VGM",
  SealMismatch: "عدم تطابق ختم",
  Overweight: "تجاوز وزن",
  GateInMissed: "فوات دخول الميناء",
  VesselDelay: "تأخر السفينة",
  VesselChange: "تغيير السفينة",
  RollOver: "تأجيل لرحلة تالية",
  PortCongestion: "ازدحام الميناء",
  TransshipmentDelay: "تأخر شحن عابر",
  CargoDamage: "تلف البضاعة",
  TemperatureExcursion: "تجاوز درجة الحرارة",
  ReeferFailure: "عطل التبريد",
  Shortage: "عجز كمية",
  Demurrage: "غرامة تأخير حاوية",
  Detention: "غرامة احتجاز",
  Strike: "إضراب",
  Weather: "طقس",
  PortClosure: "إغلاق ميناء",
};

export const logisticsExceptionSeverityLabel: Record<string, string> = {
  Informational: "معلوماتي",
  Low: "منخفضة",
  Medium: "متوسطة",
  High: "عالية",
  Critical: "حرجة",
};

export const logisticsExceptionSeverityStyle: Record<string, string> = {
  Informational: "bg-secondary text-secondary-foreground hover:bg-secondary",
  Low: "bg-sky-100 text-sky-700 hover:bg-sky-100",
  Medium: "bg-amber-100 text-amber-700 hover:bg-amber-100",
  High: "bg-orange-100 text-orange-700 hover:bg-orange-100",
  Critical: "bg-rose-100 text-rose-700 hover:bg-rose-100",
};

export const logisticsExceptionStatusLabel: Record<string, string> = {
  Open: "مفتوح",
  InProgress: "جاري المعالجة",
  Resolved: "تم الحل",
  Closed: "مقفول",
};

export const logisticsExceptionStatusStyle: Record<string, string> = {
  Open: "bg-rose-100 text-rose-700 hover:bg-rose-100",
  InProgress: "bg-amber-100 text-amber-700 hover:bg-amber-100",
  Resolved: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  Closed: "bg-secondary text-secondary-foreground hover:bg-secondary",
};

export const freeTimeChargeTypeLabel: Record<string, string> = {
  Demurrage: "غرامة تأخير (Demurrage)",
  Detention: "غرامة احتجاز (Detention)",
};

export const freeTimeLocationLabel: Record<string, string> = {
  Origin: "المنشأ",
  Destination: "الوصول",
};

export const transportTripStatusLabel: Record<string, string> = {
  Scheduled: "مجدولة",
  InProgress: "جارية",
  Completed: "مكتملة",
  Delayed: "متأخّرة",
  Cancelled: "ملغاة",
};

export const transportTripStatusStyle: Record<string, string> = {
  Scheduled: "bg-sky-100 text-sky-700 hover:bg-sky-100",
  InProgress: "bg-amber-100 text-amber-700 hover:bg-amber-100",
  Completed: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  Delayed: "bg-rose-100 text-rose-700 hover:bg-rose-100",
  Cancelled: "bg-secondary text-secondary-foreground hover:bg-secondary",
};

export const claimTypeLabel: Record<string, string> = {
  CargoDamage: "تلف بضاعة",
  TemperatureDamage: "تلف حراري",
  WetDamage: "تلف بالرطوبة",
  Shortage: "عجز كمية",
  Loss: "فقدان",
  Delay: "تأخير",
  ContainerDamage: "تلف حاوية",
  Overcharge: "رسوم زائدة",
  InvoiceDispute: "نزاع فاتورة",
  DemurrageDispute: "نزاع غرامة تأخير",
  ServiceFailure: "قصور خدمة",
};

export const claimStatusLabel: Record<string, string> = {
  Draft: "مسودة",
  EvidenceCollection: "جمع أدلة",
  Submitted: "تم التقديم",
  UnderReview: "قيد المراجعة",
  AdditionalInfoRequired: "مطلوب بيانات إضافية",
  Accepted: "مقبولة",
  PartiallyAccepted: "مقبولة جزئيًا",
  Rejected: "مرفوضة",
  Settled: "تمت التسوية",
  Closed: "مقفولة",
};

export const claimStatusStyle: Record<string, string> = {
  Draft: "bg-secondary text-secondary-foreground hover:bg-secondary",
  EvidenceCollection: "bg-sky-100 text-sky-700 hover:bg-sky-100",
  Submitted: "bg-sky-100 text-sky-700 hover:bg-sky-100",
  UnderReview: "bg-amber-100 text-amber-700 hover:bg-amber-100",
  AdditionalInfoRequired: "bg-amber-100 text-amber-700 hover:bg-amber-100",
  Accepted: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  PartiallyAccepted: "bg-amber-100 text-amber-700 hover:bg-amber-100",
  Rejected: "bg-rose-100 text-rose-700 hover:bg-rose-100",
  Settled: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  Closed: "bg-secondary text-secondary-foreground hover:bg-secondary",
};

export const serviceProviderTypeLabel: Record<string, string> = {
  ShippingLine: "شركة شحن بحري",
  FreightForwarder: "وكيل شحن",
  TruckingCompany: "شركة نقل بري",
  CustomsBroker: "مخلّص جمركي",
  PortAgent: "وكيل ميناء",
  Warehouse: "مستودع",
  Surveyor: "مساح/خبير معاينة",
  InsuranceCompany: "شركة تأمين",
  Courier: "بريد سريع",
  ColdStorage: "تخزين مبرّد",
  ContainerDepot: "ساحة حاويات",
};

export const serviceProviderStatusLabel: Record<string, string> = {
  Preferred: "مفضّل",
  Approved: "معتمد",
  Conditional: "معتمد بشروط",
  UnderReview: "قيد المراجعة",
  Suspended: "موقوف",
  Blacklisted: "محظور",
};

export const serviceProviderStatusStyle: Record<string, string> = {
  Preferred: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  Approved: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  Conditional: "bg-amber-100 text-amber-700 hover:bg-amber-100",
  UnderReview: "bg-sky-100 text-sky-700 hover:bg-sky-100",
  Suspended: "bg-rose-100 text-rose-700 hover:bg-rose-100",
  Blacklisted: "bg-rose-100 text-rose-700 hover:bg-rose-100",
};

export const routeClassificationLabel: Record<string, string> = {
  Preferred: "مفضّل",
  Approved: "معتمد",
  Conditional: "معتمد بشروط",
  HighRisk: "مخاطرة عالية",
  Avoid: "يُتجنَّب",
  UnderReview: "قيد المراجعة",
};

export const routeClassificationStyle: Record<string, string> = {
  Preferred: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  Approved: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  Conditional: "bg-amber-100 text-amber-700 hover:bg-amber-100",
  HighRisk: "bg-rose-100 text-rose-700 hover:bg-rose-100",
  Avoid: "bg-rose-100 text-rose-700 hover:bg-rose-100",
  UnderReview: "bg-sky-100 text-sky-700 hover:bg-sky-100",
};

export const freightQuoteStatusLabel: Record<string, string> = {
  Draft: "مسودة",
  Approved: "معتمد",
  Expired: "منتهي",
};

export const freightQuoteStatusStyle: Record<string, string> = {
  Draft: "bg-secondary text-secondary-foreground hover:bg-secondary",
  Approved: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  Expired: "bg-rose-100 text-rose-700 hover:bg-rose-100",
};

export const freightQuoteLineCategoryLabel: Record<string, string> = {
  Origin: "منشأ",
  Freight: "أجرة شحن",
  Destination: "وصول",
  Insurance: "تأمين",
  Other: "أخرى",
};

/** 8 معالم ثابتة بتتقترح تلقائيًا وقت إنشاء أي شحنة — راجع docs/ERD.md §9 وschema.prisma تعليق Milestone. */
export const DEFAULT_MILESTONES = [
  "Cargo Ready",
  "Booking Confirmed",
  "Empty Container Pickup",
  "Loading Completed",
  "VGM Submitted",
  "Customs Cleared (Export)",
  "Gate-In",
  "Vessel Departed",
  "Destination Arrival",
  "Delivered",
] as const;
