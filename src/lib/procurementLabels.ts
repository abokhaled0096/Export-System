// تسميات عربية موحّدة لكل enums وحدة 7 (التوريد والإنتاج والجودة) — راجع docs/ERD.md §10.

export const supplierTypeLabel: Record<string, string> = {
  Farm: "مزرعة",
  Farmer: "مزارع",
  Aggregator: "مجمِّع",
  Trader: "تاجر",
  Processor: "مُصنِّع",
  Manufacturer: "منتج",
  PackingHouse: "دار تعبئة",
  FreezingFacility: "منشأة تجميد",
  DryingFacility: "منشأة تجفيف",
  PackagingSupplier: "مورّد تغليف",
  Warehouse: "مستودع",
  ColdStore: "مخزن مبرّد",
  Laboratory: "معمل",
};

export const supplierStatusLabel: Record<string, string> = {
  Identified: "مبدئي",
  Contacted: "تم التواصل",
  UnderReview: "قيد المراجعة",
  DocumentsPending: "مستندات معلّقة",
  AuditRequired: "يحتاج تدقيق",
  SampleRequired: "يحتاج عيّنة",
  Conditional: "معتمد بشروط",
  Approved: "معتمد",
  Preferred: "مفضّل",
  Suspended: "موقوف",
  Rejected: "مرفوض",
  Blacklisted: "محظور",
  Archived: "مؤرشف",
};

export const supplierStatusStyle: Record<string, string> = {
  Identified: "bg-secondary text-secondary-foreground hover:bg-secondary",
  Contacted: "bg-sky-100 text-sky-700 hover:bg-sky-100",
  UnderReview: "bg-sky-100 text-sky-700 hover:bg-sky-100",
  DocumentsPending: "bg-amber-100 text-amber-700 hover:bg-amber-100",
  AuditRequired: "bg-amber-100 text-amber-700 hover:bg-amber-100",
  SampleRequired: "bg-amber-100 text-amber-700 hover:bg-amber-100",
  Conditional: "bg-amber-100 text-amber-700 hover:bg-amber-100",
  Approved: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  Preferred: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  Suspended: "bg-rose-100 text-rose-700 hover:bg-rose-100",
  Rejected: "bg-rose-100 text-rose-700 hover:bg-rose-100",
  Blacklisted: "bg-rose-100 text-rose-700 hover:bg-rose-100",
  Archived: "bg-secondary text-secondary-foreground hover:bg-secondary",
};

export const facilityTypeLabel: Record<string, string> = {
  Farm: "مزرعة",
  Field: "حقل",
  CollectionCenter: "مركز تجميع",
  PackingHouse: "دار تعبئة",
  Factory: "مصنع",
  FreezingFacility: "منشأة تجميد",
  DryingFacility: "منشأة تجفيف",
  ProcessingFacility: "منشأة تصنيع",
  Warehouse: "مستودع",
  ColdStore: "مخزن مبرّد",
  Laboratory: "معمل",
};

export const facilityStatusLabel: Record<string, string> = {
  Active: "نشطة",
  UnderReview: "قيد المراجعة",
  Suspended: "موقوفة",
  Closed: "مقفولة",
};

export const facilityStatusStyle: Record<string, string> = {
  Active: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  UnderReview: "bg-sky-100 text-sky-700 hover:bg-sky-100",
  Suspended: "bg-rose-100 text-rose-700 hover:bg-rose-100",
  Closed: "bg-secondary text-secondary-foreground hover:bg-secondary",
};

export const sourcingRequestStatusLabel: Record<string, string> = {
  Draft: "مسودة",
  Approved: "معتمد",
  RFQPreparation: "تجهيز طلب عروض",
  RFQSent: "تم إرسال طلب العروض",
  QuotesReceived: "عروض مستلمة",
  UnderEvaluation: "قيد التقييم",
  Negotiation: "تفاوض",
  SupplierSelected: "تم اختيار المورّد",
  POIssued: "تم إصدار أمر الشراء",
  Cancelled: "ملغى",
  Closed: "مقفول",
};

export const sourcingRequestStatusStyle: Record<string, string> = {
  Draft: "bg-secondary text-secondary-foreground hover:bg-secondary",
  Approved: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  RFQPreparation: "bg-sky-100 text-sky-700 hover:bg-sky-100",
  RFQSent: "bg-sky-100 text-sky-700 hover:bg-sky-100",
  QuotesReceived: "bg-sky-100 text-sky-700 hover:bg-sky-100",
  UnderEvaluation: "bg-amber-100 text-amber-700 hover:bg-amber-100",
  Negotiation: "bg-amber-100 text-amber-700 hover:bg-amber-100",
  SupplierSelected: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  POIssued: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  Cancelled: "bg-secondary text-secondary-foreground hover:bg-secondary",
  Closed: "bg-secondary text-secondary-foreground hover:bg-secondary",
};

export const purchaseOrderStatusLabel: Record<string, string> = {
  Draft: "مسودة",
  PendingApproval: "بانتظار الموافقة",
  Approved: "معتمد",
  Sent: "تم الإرسال",
  Acknowledged: "تم الإقرار",
  PartiallyConfirmed: "مؤكّد جزئيًا",
  Confirmed: "مؤكّد",
  InProduction: "قيد الإنتاج",
  PartiallyDelivered: "تسليم جزئي",
  Delivered: "تم التسليم",
  Closed: "مقفول",
  Cancelled: "ملغى",
  Disputed: "متنازع عليه",
};

export const batchQualityStatusLabel: Record<string, string> = {
  Pending: "قيد الانتظار",
  Released: "مُفرَج عنها",
  Held: "محجوزة",
  Rejected: "مرفوضة",
};

export const batchQualityStatusStyle: Record<string, string> = {
  Pending: "bg-secondary text-secondary-foreground hover:bg-secondary",
  Released: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  Held: "bg-amber-100 text-amber-700 hover:bg-amber-100",
  Rejected: "bg-rose-100 text-rose-700 hover:bg-rose-100",
};

export const batchStatusLabel: Record<string, string> = {
  Planned: "مخطَّطة",
  InProduction: "قيد الإنتاج",
  Completed: "مكتملة",
  OnHold: "معلَّقة",
  Cancelled: "ملغاة",
};

export const batchStatusStyle: Record<string, string> = {
  Planned: "bg-secondary text-secondary-foreground hover:bg-secondary",
  InProduction: "bg-sky-100 text-sky-700 hover:bg-sky-100",
  Completed: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  OnHold: "bg-amber-100 text-amber-700 hover:bg-amber-100",
  Cancelled: "bg-secondary text-secondary-foreground hover:bg-secondary",
};

export const inspectionStageLabel: Record<string, string> = {
  PreQualification: "تأهيل مبدئي",
  IncomingRawMaterial: "استلام خام",
  DuringProduction: "أثناء الإنتاج",
  PrePackaging: "قبل التعبئة",
  PackagingInspection: "فحص التعبئة",
  FinalProduct: "المنتج النهائي",
  PreLoading: "قبل التحميل",
  ContainerInspection: "فحص الحاوية",
};

export const inspectionResultLabel: Record<string, string> = {
  Pass: "ناجح",
  ConditionalPass: "ناجح بشروط",
  Fail: "فاشل",
};

export const inspectionResultStyle: Record<string, string> = {
  Pass: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  ConditionalPass: "bg-amber-100 text-amber-700 hover:bg-amber-100",
  Fail: "bg-rose-100 text-rose-700 hover:bg-rose-100",
};

export const qualityReleaseStatusLabel: Record<string, string> = {
  Released: "مُفرَج عنه",
  PartialRelease: "إفراج جزئي",
  ConditionalRelease: "إفراج بشروط",
  Held: "محجوز",
  Rejected: "مرفوض",
};

export const qualityReleaseStatusStyle: Record<string, string> = {
  Released: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  PartialRelease: "bg-amber-100 text-amber-700 hover:bg-amber-100",
  ConditionalRelease: "bg-amber-100 text-amber-700 hover:bg-amber-100",
  Held: "bg-secondary text-secondary-foreground hover:bg-secondary",
  Rejected: "bg-rose-100 text-rose-700 hover:bg-rose-100",
};

export const lotStatusLabel: Record<string, string> = {
  Draft: "مسودة",
  Ready: "جاهزة",
  Allocated: "مخصَّصة",
  Shipped: "تم الشحن",
  Consumed: "مُستهلَكة",
  Cancelled: "ملغاة",
};

export const lotStatusStyle: Record<string, string> = {
  Draft: "bg-secondary text-secondary-foreground hover:bg-secondary",
  Ready: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  Allocated: "bg-sky-100 text-sky-700 hover:bg-sky-100",
  Shipped: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  Consumed: "bg-secondary text-secondary-foreground hover:bg-secondary",
  Cancelled: "bg-secondary text-secondary-foreground hover:bg-secondary",
};

export const purchaseOrderStatusStyle: Record<string, string> = {
  Draft: "bg-secondary text-secondary-foreground hover:bg-secondary",
  PendingApproval: "bg-amber-100 text-amber-700 hover:bg-amber-100",
  Approved: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  Sent: "bg-sky-100 text-sky-700 hover:bg-sky-100",
  Acknowledged: "bg-sky-100 text-sky-700 hover:bg-sky-100",
  PartiallyConfirmed: "bg-amber-100 text-amber-700 hover:bg-amber-100",
  Confirmed: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  InProduction: "bg-sky-100 text-sky-700 hover:bg-sky-100",
  PartiallyDelivered: "bg-amber-100 text-amber-700 hover:bg-amber-100",
  Delivered: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  Closed: "bg-secondary text-secondary-foreground hover:bg-secondary",
  Cancelled: "bg-secondary text-secondary-foreground hover:bg-secondary",
  Disputed: "bg-rose-100 text-rose-700 hover:bg-rose-100",
};

export const productionProcessLabel: Record<string, string> = {
  Sorting: "فرز",
  Grading: "تدريج",
  Washing: "غسيل",
  Cutting: "تقطيع",
  Peeling: "تقشير",
  Freezing: "تجميد",
  Drying: "تجفيف",
  Milling: "طحن",
  Sterilization: "تعقيم",
  Fumigation: "تبخير",
  Extraction: "استخلاص",
  Mixing: "خلط",
  Packing: "تعبئة",
  Labeling: "وضع بطاقات",
  Palletizing: "تطبيل",
};

export const productionPlanStatusLabel: Record<string, string> = {
  Draft: "مسودة",
  Scheduled: "مجدولة",
  MaterialsPending: "بانتظار المواد",
  Ready: "جاهزة",
  InProduction: "قيد الإنتاج",
  QualityHold: "محجوزة للجودة",
  Rework: "إعادة تصنيع",
  Completed: "مكتملة",
  Delayed: "متأخرة",
  Cancelled: "ملغاة",
};

export const productionPlanStatusStyle: Record<string, string> = {
  Draft: "bg-secondary text-secondary-foreground hover:bg-secondary",
  Scheduled: "bg-sky-100 text-sky-700 hover:bg-sky-100",
  MaterialsPending: "bg-amber-100 text-amber-700 hover:bg-amber-100",
  Ready: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  InProduction: "bg-sky-100 text-sky-700 hover:bg-sky-100",
  QualityHold: "bg-rose-100 text-rose-700 hover:bg-rose-100",
  Rework: "bg-amber-100 text-amber-700 hover:bg-amber-100",
  Completed: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  Delayed: "bg-amber-100 text-amber-700 hover:bg-amber-100",
  Cancelled: "bg-secondary text-secondary-foreground hover:bg-secondary",
};

export const inventoryTypeLabel: Record<string, string> = {
  RawMaterial: "خام",
  WIP: "تحت التصنيع",
  FinishedGoods: "تام الصنع",
  PackagingMaterial: "مواد تعبئة",
};

export const inventoryStatusLabel: Record<string, string> = {
  Expected: "متوقّع",
  Received: "مستلم",
  Quarantine: "حجر",
  Accepted: "مقبول",
  Conditional: "مقبول بشروط",
  Rejected: "مرفوض",
  Reserved: "محجوز",
  InProduction: "قيد الإنتاج",
  Consumed: "مُستهلَك",
  Expired: "منتهي الصلاحية",
};

export const inventoryStatusStyle: Record<string, string> = {
  Expected: "bg-secondary text-secondary-foreground hover:bg-secondary",
  Received: "bg-sky-100 text-sky-700 hover:bg-sky-100",
  Quarantine: "bg-amber-100 text-amber-700 hover:bg-amber-100",
  Accepted: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  Conditional: "bg-amber-100 text-amber-700 hover:bg-amber-100",
  Rejected: "bg-rose-100 text-rose-700 hover:bg-rose-100",
  Reserved: "bg-sky-100 text-sky-700 hover:bg-sky-100",
  InProduction: "bg-sky-100 text-sky-700 hover:bg-sky-100",
  Consumed: "bg-secondary text-secondary-foreground hover:bg-secondary",
  Expired: "bg-rose-100 text-rose-700 hover:bg-rose-100",
};

export const ncrTypeLabel: Record<string, string> = {
  RawMaterialDefect: "عيب في الخام",
  SpecificationFailure: "عدم مطابقة مواصفة",
  PackagingFailure: "عيب تعبئة",
  LabelError: "خطأ بطاقة بيانات",
  WeightDeviation: "انحراف وزن",
  MoistureFailure: "عدم مطابقة رطوبة",
  PurityFailure: "عدم مطابقة نقاء",
  MicrobiologicalFailure: "عدم مطابقة ميكروبيولوجية",
  PesticideFailure: "عدم مطابقة مبيدات",
  TemperatureFailure: "عدم مطابقة حرارة",
  ForeignMatter: "مواد غريبة",
  TraceabilityFailure: "فشل تتبّع",
  DocumentationFailure: "نقص مستندات",
  SupplierDelay: "تأخير مورّد",
  QuantityShortage: "نقص كمية",
  MixedBatch: "خلط دفعات",
};

export const ncrSeverityLabel: Record<string, string> = {
  Observation: "ملاحظة",
  Minor: "بسيطة",
  Major: "كبيرة",
  Critical: "حرجة",
};

export const ncrSeverityStyle: Record<string, string> = {
  Observation: "bg-secondary text-secondary-foreground hover:bg-secondary",
  Minor: "bg-sky-100 text-sky-700 hover:bg-sky-100",
  Major: "bg-amber-100 text-amber-700 hover:bg-amber-100",
  Critical: "bg-rose-100 text-rose-700 hover:bg-rose-100",
};

export const ncrStatusLabel: Record<string, string> = {
  Open: "مفتوحة",
  Investigation: "قيد التحقيق",
  ActionInProgress: "إجراء قيد التنفيذ",
  Closed: "مقفولة",
};

export const ncrStatusStyle: Record<string, string> = {
  Open: "bg-rose-100 text-rose-700 hover:bg-rose-100",
  Investigation: "bg-amber-100 text-amber-700 hover:bg-amber-100",
  ActionInProgress: "bg-sky-100 text-sky-700 hover:bg-sky-100",
  Closed: "bg-secondary text-secondary-foreground hover:bg-secondary",
};

export const labTestTypeLabel: Record<string, string> = {
  Physical: "فيزيائي",
  Chemical: "كيميائي",
  Microbiological: "ميكروبيولوجي",
  PesticideResidues: "متبقيات مبيدات",
  HeavyMetals: "معادن ثقيلة",
  Moisture: "رطوبة",
  Purity: "نقاء",
  Aflatoxins: "أفلاتوكسين",
  Mycotoxins: "ميكوتوكسين",
  Allergens: "مسبّبات حساسية",
  GMO: "معدَّل وراثيًا",
};

export const labTestPassFailLabel: Record<string, string> = {
  Pass: "ناجح",
  Fail: "فاشل",
};

export const labTestPassFailStyle: Record<string, string> = {
  Pass: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  Fail: "bg-rose-100 text-rose-700 hover:bg-rose-100",
};

export const farmRiskLevelLabel: Record<string, string> = {
  Low: "منخفضة",
  Medium: "متوسطة",
  High: "عالية",
};

export const farmRiskLevelStyle: Record<string, string> = {
  Low: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  Medium: "bg-amber-100 text-amber-700 hover:bg-amber-100",
  High: "bg-rose-100 text-rose-700 hover:bg-rose-100",
};

export const batchRawMaterialSourceTypeLabel: Record<string, string> = {
  Farm: "مزرعة",
  IncomingInventory: "مخزون وارد",
};

export const supplierRFQStatusLabel: Record<string, string> = {
  Draft: "مسودة",
  Sent: "تم الإرسال",
  Responded: "تم الرد",
  Expired: "منتهي",
  Cancelled: "ملغى",
};

export const supplierRFQStatusStyle: Record<string, string> = {
  Draft: "bg-secondary text-secondary-foreground hover:bg-secondary",
  Sent: "bg-sky-100 text-sky-700 hover:bg-sky-100",
  Responded: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  Expired: "bg-secondary text-secondary-foreground hover:bg-secondary",
  Cancelled: "bg-secondary text-secondary-foreground hover:bg-secondary",
};

export const batchMarketEligibilityStatusLabel: Record<string, string> = {
  Eligible: "مؤهّلة",
  Conditional: "مؤهّلة بشروط",
  NotEligible: "غير مؤهّلة",
  NotAssessed: "لم تُقيَّم",
};

export const batchMarketEligibilityStatusStyle: Record<string, string> = {
  Eligible: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  Conditional: "bg-amber-100 text-amber-700 hover:bg-amber-100",
  NotEligible: "bg-rose-100 text-rose-700 hover:bg-rose-100",
  NotAssessed: "bg-secondary text-secondary-foreground hover:bg-secondary",
};

// وحدة 7 — الشريحة الخامسة والأخيرة (إقفال 23/23).

export const supplierAuditDecisionLabel: Record<string, string> = {
  Approved: "معتمد",
  ConditionalApproval: "اعتماد مشروط",
  Rejected: "مرفوض",
};

export const supplierAuditDecisionStyle: Record<string, string> = {
  Approved: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  ConditionalApproval: "bg-amber-100 text-amber-700 hover:bg-amber-100",
  Rejected: "bg-rose-100 text-rose-700 hover:bg-rose-100",
};

export const supplyContractTypeLabel: Record<string, string> = {
  Framework: "عقد إطاري",
  TollProcessing: "تصنيع بالعمولة",
  FarmingContract: "عقد زراعة",
  ExclusiveSupply: "توريد حصري",
  SeasonalContract: "عقد موسمي",
  SpotAgreement: "اتفاق فوري",
};

export const supplyContractStatusLabel: Record<string, string> = {
  Draft: "مسودة",
  UnderNegotiation: "قيد التفاوض",
  Active: "ساري",
  Expired: "منتهي",
  Terminated: "مفسوخ",
};

export const supplyContractStatusStyle: Record<string, string> = {
  Draft: "bg-secondary text-secondary-foreground hover:bg-secondary",
  UnderNegotiation: "bg-amber-100 text-amber-700 hover:bg-amber-100",
  Active: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  Expired: "bg-secondary text-secondary-foreground hover:bg-secondary",
  Terminated: "bg-rose-100 text-rose-700 hover:bg-rose-100",
};

export const packagingMaterialTypeLabel: Record<string, string> = {
  Carton: "كرتونة",
  Bag: "كيس",
  Label: "ليبل",
  Jar: "برطمان",
  Bottle: "زجاجة",
  Pallet: "طبلية",
  StretchFilm: "شريط تغليف",
  Strap: "شريط ربط",
  InnerLiner: "بطانة داخلية",
  Divider: "فاصل",
};

export const packagingMaterialStatusLabel: Record<string, string> = {
  Requested: "مطلوبة",
  Ordered: "تم الطلب",
  PartiallyReceived: "استلام جزئي",
  Received: "تم الاستلام",
  Accepted: "مقبولة",
  Rejected: "مرفوضة",
};

export const packagingMaterialStatusStyle: Record<string, string> = {
  Requested: "bg-secondary text-secondary-foreground hover:bg-secondary",
  Ordered: "bg-sky-100 text-sky-700 hover:bg-sky-100",
  PartiallyReceived: "bg-amber-100 text-amber-700 hover:bg-amber-100",
  Received: "bg-sky-100 text-sky-700 hover:bg-sky-100",
  Accepted: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  Rejected: "bg-rose-100 text-rose-700 hover:bg-rose-100",
};

export const supplierSamplePurposeLabel: Record<string, string> = {
  Qualification: "تأهيل",
  PrePurchase: "قبل الشراء",
  Production: "إنتاج",
  Retention: "احتفاظ",
  Customer: "عميل",
  Laboratory: "معملي",
  Shipment: "شحنة",
};

export const supplierSampleResultLabel: Record<string, string> = {
  Pending: "قيد الانتظار",
  Approved: "معتمدة",
  Conditional: "مقبولة بشروط",
  Rejected: "مرفوضة",
};

export const supplierSampleResultStyle: Record<string, string> = {
  Pending: "bg-secondary text-secondary-foreground hover:bg-secondary",
  Approved: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  Conditional: "bg-amber-100 text-amber-700 hover:bg-amber-100",
  Rejected: "bg-rose-100 text-rose-700 hover:bg-rose-100",
};

export const supplierSampleStatusLabel: Record<string, string> = {
  Requested: "مطلوبة",
  Sent: "تم الإرسال",
  Received: "تم الاستلام",
  Evaluated: "تم التقييم",
  Closed: "مغلقة",
};

export const supplierSampleStatusStyle: Record<string, string> = {
  Requested: "bg-secondary text-secondary-foreground hover:bg-secondary",
  Sent: "bg-sky-100 text-sky-700 hover:bg-sky-100",
  Received: "bg-sky-100 text-sky-700 hover:bg-sky-100",
  Evaluated: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  Closed: "bg-secondary text-secondary-foreground hover:bg-secondary",
};

export const cargoReadinessStatusLabel: Record<string, string> = {
  NotStarted: "لم تبدأ",
  MaterialsPending: "بانتظار الخامات",
  InProduction: "قيد الإنتاج",
  QualityHold: "محجوزة للجودة",
  PartialReady: "جاهزة جزئيًا",
  ReadyWithConditions: "جاهزة بشروط",
  CargoReady: "الشحنة جاهزة",
  LoadingReleased: "أُفرِج للتحميل",
  Blocked: "معطّلة",
  Cancelled: "ملغاة",
};

export const cargoReadinessStatusStyle: Record<string, string> = {
  NotStarted: "bg-secondary text-secondary-foreground hover:bg-secondary",
  MaterialsPending: "bg-amber-100 text-amber-700 hover:bg-amber-100",
  InProduction: "bg-sky-100 text-sky-700 hover:bg-sky-100",
  QualityHold: "bg-rose-100 text-rose-700 hover:bg-rose-100",
  PartialReady: "bg-amber-100 text-amber-700 hover:bg-amber-100",
  ReadyWithConditions: "bg-amber-100 text-amber-700 hover:bg-amber-100",
  CargoReady: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  LoadingReleased: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  Blocked: "bg-rose-100 text-rose-700 hover:bg-rose-100",
  Cancelled: "bg-secondary text-secondary-foreground hover:bg-secondary",
};

export const supplierPerformanceClassificationLabel: Record<string, string> = {
  Strategic: "استراتيجي",
  Preferred: "مفضّل",
  Approved: "معتمد",
  Conditional: "مشروط",
  ImprovementRequired: "يحتاج تحسين",
  Suspended: "موقوف",
  ExitRecommended: "يُنصح بإنهاء التعامل",
};

export const supplierPerformanceClassificationStyle: Record<string, string> = {
  Strategic: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  Preferred: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  Approved: "bg-sky-100 text-sky-700 hover:bg-sky-100",
  Conditional: "bg-amber-100 text-amber-700 hover:bg-amber-100",
  ImprovementRequired: "bg-amber-100 text-amber-700 hover:bg-amber-100",
  Suspended: "bg-rose-100 text-rose-700 hover:bg-rose-100",
  ExitRecommended: "bg-rose-100 text-rose-700 hover:bg-rose-100",
};
