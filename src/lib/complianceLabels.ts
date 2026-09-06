// تسميات عربية موحّدة لكل enums وحدة 5 (الامتثال والجمارك) — مشتركة بين كل شاشات
// /compliance عشان محدش يكرر نفس الخرائط في كل ملف. راجع docs/SCOPE-P5.md.

export const operationTypeLabel: Record<string, string> = {
  CommercialExport: "تصدير تجاري",
  Sample: "عيّنة",
  Tender: "مناقصة",
  TrialShipment: "شحنة تجريبية",
  AnnualContract: "عقد سنوي",
  PrivateLabel: "علامة خاصة",
};

export const complianceCaseStatusLabel: Record<string, string> = {
  Draft: "مسودة",
  UnderAssessment: "جاري التقييم",
  MissingInformation: "بيانات ناقصة",
  Conditional: "مشروط",
  Compliant: "متوافق",
  Hold: "معلّق",
  Blocked: "محجوب",
  ApprovedForPricing: "معتمد للتسعير",
  ApprovedForContract: "معتمد للتعاقد",
  ApprovedForProduction: "معتمد للإنتاج",
  ApprovedForShipment: "معتمد للشحن",
  Closed: "مقفول",
  Rejected: "مرفوض",
};

export const complianceCaseStatusStyle: Record<string, string> = {
  Draft: "bg-secondary text-secondary-foreground hover:bg-secondary",
  UnderAssessment: "bg-sky-100 text-sky-700 hover:bg-sky-100",
  MissingInformation: "bg-amber-100 text-amber-700 hover:bg-amber-100",
  Conditional: "bg-amber-100 text-amber-700 hover:bg-amber-100",
  Compliant: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  Hold: "bg-amber-100 text-amber-700 hover:bg-amber-100",
  Blocked: "bg-rose-100 text-rose-700 hover:bg-rose-100",
  ApprovedForPricing: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  ApprovedForContract: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  ApprovedForProduction: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  ApprovedForShipment: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  Closed: "bg-secondary text-secondary-foreground hover:bg-secondary",
  Rejected: "bg-rose-100 text-rose-700 hover:bg-rose-100",
};

export const requirementCategoryLabel: Record<string, string> = {
  MarketAccess: "دخول السوق",
  Customs: "جمارك",
  Health: "صحة",
  Phytosanitary: "صحة نباتية",
  Quality: "جودة",
  Packaging: "تعبئة",
  Labeling: "بيانات العبوة",
  Origin: "المنشأ",
  Transport: "نقل",
  Banking: "بنكي",
};

export const requirementStatusLabel: Record<string, string> = {
  NotApplicable: "غير منطبق",
  Applicable: "منطبق",
  PossiblyApplicable: "منطبق محتمل",
  Met: "مستوفى",
  PartiallyMet: "مستوفى جزئيًا",
  NotMet: "غير مستوفى",
  Blocking: "حاجب",
  NeedsExpertReview: "محتاج مراجعة متخصص",
};

export const requirementStatusStyle: Record<string, string> = {
  NotApplicable: "bg-secondary text-secondary-foreground hover:bg-secondary",
  Applicable: "bg-sky-100 text-sky-700 hover:bg-sky-100",
  PossiblyApplicable: "bg-sky-100 text-sky-700 hover:bg-sky-100",
  Met: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  PartiallyMet: "bg-amber-100 text-amber-700 hover:bg-amber-100",
  NotMet: "bg-rose-100 text-rose-700 hover:bg-rose-100",
  Blocking: "bg-rose-100 text-rose-700 hover:bg-rose-100",
  NeedsExpertReview: "bg-amber-100 text-amber-700 hover:bg-amber-100",
};

export const gateStatusLabel: Record<string, string> = {
  Passed: "عدّت",
  PassedWithConditions: "عدّت بشروط",
  Pending: "قيد الانتظار",
  Failed: "فشلت",
  Waived: "اتعدّت استثنائيًا",
  NotApplicable: "غير منطبقة",
};

export const gateStatusStyle: Record<string, string> = {
  Passed: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  PassedWithConditions: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  Pending: "bg-secondary text-secondary-foreground hover:bg-secondary",
  Failed: "bg-rose-100 text-rose-700 hover:bg-rose-100",
  Waived: "bg-amber-100 text-amber-700 hover:bg-amber-100",
  NotApplicable: "bg-secondary text-secondary-foreground hover:bg-secondary",
};

export const hsClassificationStatusLabel: Record<string, string> = {
  Proposed: "مقترح",
  UnderReview: "قيد المراجعة",
  ConfirmedInternally: "مؤكَّد داخليًا",
  ConfirmedByBroker: "مؤكَّد من المخلّص",
  ConfirmedByRuling: "مؤكَّد بقرار جمركي",
  Disputed: "متنازع عليه",
  NeedsExpertReview: "محتاج مراجعة متخصص",
  Rejected: "مرفوض",
};

export const certificateTypeLabel: Record<string, string> = {
  HACCP: "HACCP",
  BRCGS: "BRCGS",
  IFS: "IFS",
  FSSC: "FSSC 22000",
  GlobalGAP: "GlobalG.A.P.",
  ISO: "ISO",
  Organic: "عضوي",
  Halal: "حلال",
  Kosher: "كوشير",
  GMP: "GMP",
  Phytosanitary: "شهادة صحة نباتية",
  HealthCertificate: "شهادة صحية",
  COA: "شهادة تحليل (COA)",
  Fumigation: "تبخير",
};

export const certificateStatusLabel: Record<string, string> = {
  Valid: "سارية",
  ExpiringSoon: "قربت تنتهي",
  Expired: "منتهية",
  Suspended: "موقوفة",
  UnderRenewal: "قيد التجديد",
  Pending: "قيد الإصدار",
  Rejected: "مرفوضة",
  NotVerified: "غير مُتحقَّق منها",
};

export const certificateStatusStyle: Record<string, string> = {
  Valid: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  ExpiringSoon: "bg-amber-100 text-amber-700 hover:bg-amber-100",
  Expired: "bg-rose-100 text-rose-700 hover:bg-rose-100",
  Suspended: "bg-rose-100 text-rose-700 hover:bg-rose-100",
  UnderRenewal: "bg-amber-100 text-amber-700 hover:bg-amber-100",
  Pending: "bg-secondary text-secondary-foreground hover:bg-secondary",
  Rejected: "bg-rose-100 text-rose-700 hover:bg-rose-100",
  NotVerified: "bg-secondary text-secondary-foreground hover:bg-secondary",
};

// وحدة 5 — الشريحة الثانية (30 أغسطس): Registration + OriginProof — راجع docs/SCOPE-P5.md.

export const registrationTypeLabel: Record<string, string> = {
  FacilityRegistration: "تسجيل منشأة",
  ProductRegistration: "تسجيل منتج",
  ExporterRegistration: "تسجيل مُصدِّر",
  ImporterRegistration: "تسجيل مستورد",
  LabelRegistration: "تسجيل بيانات عبوة",
};

export const registrationStatusLabel: Record<string, string> = {
  NotStarted: "لسه ما بدأش",
  CollectingDocuments: "جاري تجميع المستندات",
  Submitted: "مُقدَّم",
  UnderReview: "قيد المراجعة",
  InspectionRequired: "محتاج معاينة",
  Approved: "معتمد",
  Rejected: "مرفوض",
  Expired: "منتهي",
  Suspended: "موقوف",
  RenewalRequired: "محتاج تجديد",
};

export const registrationStatusStyle: Record<string, string> = {
  NotStarted: "bg-secondary text-secondary-foreground hover:bg-secondary",
  CollectingDocuments: "bg-sky-100 text-sky-700 hover:bg-sky-100",
  Submitted: "bg-sky-100 text-sky-700 hover:bg-sky-100",
  UnderReview: "bg-amber-100 text-amber-700 hover:bg-amber-100",
  InspectionRequired: "bg-amber-100 text-amber-700 hover:bg-amber-100",
  Approved: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  Rejected: "bg-rose-100 text-rose-700 hover:bg-rose-100",
  Expired: "bg-rose-100 text-rose-700 hover:bg-rose-100",
  Suspended: "bg-rose-100 text-rose-700 hover:bg-rose-100",
  RenewalRequired: "bg-amber-100 text-amber-700 hover:bg-amber-100",
};

export const originProofTypeLabel: Record<string, string> = {
  EUR1: "EUR.1",
  InvoiceDeclaration: "إقرار على الفاتورة",
  StatementOnOrigin: "بيان منشأ",
  CertificateOfOrigin: "شهادة منشأ",
};

export const originProofCumulationTypeLabel: Record<string, string> = {
  None: "بلا تراكم",
  Bilateral: "ثنائي",
  Diagonal: "قطري",
  Full: "كامل",
};

export const originProofStatusLabel: Record<string, string> = {
  Draft: "مسودة",
  Issued: "مُصدَر",
  Verified: "متحقَّق منه",
  Rejected: "مرفوض",
  Expired: "منتهي",
};

export const originProofStatusStyle: Record<string, string> = {
  Draft: "bg-secondary text-secondary-foreground hover:bg-secondary",
  Issued: "bg-sky-100 text-sky-700 hover:bg-sky-100",
  Verified: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  Rejected: "bg-rose-100 text-rose-700 hover:bg-rose-100",
  Expired: "bg-rose-100 text-rose-700 hover:bg-rose-100",
};

// وحدة 5 — الشريحة التالتة (30 أغسطس): RejectionCase + LCRequirement — راجع docs/SCOPE-P5.md.

export const rejectionTypeLabel: Record<string, string> = {
  DocumentRejection: "رفض مستندات",
  SampleRejection: "رفض عيّنة",
  TestFailure: "فشل فحص",
  LabelRejection: "رفض بيانات عبوة",
  CustomsHold: "حجز جمركي",
  OriginRejection: "رفض منشأ",
  HSDispute: "نزاع تصنيف جمركي",
  HealthRejection: "رفض صحي",
  WeightMismatch: "فرق وزن",
};

export const rejectionSeverityLabel: Record<string, string> = {
  Low: "منخفضة",
  Medium: "متوسطة",
  High: "عالية",
  Critical: "حرجة",
};

export const rejectionSeverityStyle: Record<string, string> = {
  Low: "bg-secondary text-secondary-foreground hover:bg-secondary",
  Medium: "bg-amber-100 text-amber-700 hover:bg-amber-100",
  High: "bg-amber-100 text-amber-700 hover:bg-amber-100",
  Critical: "bg-rose-100 text-rose-700 hover:bg-rose-100",
};

export const rejectionCaseStatusLabel: Record<string, string> = {
  Open: "مفتوحة",
  UnderInvestigation: "قيد التحقيق",
  CAPARequired: "محتاجة إجراء تصحيحي",
  Resolved: "مُحلولة",
  Closed: "مقفولة",
  Disputed: "متنازع عليها",
};

export const rejectionCaseStatusStyle: Record<string, string> = {
  Open: "bg-rose-100 text-rose-700 hover:bg-rose-100",
  UnderInvestigation: "bg-amber-100 text-amber-700 hover:bg-amber-100",
  CAPARequired: "bg-amber-100 text-amber-700 hover:bg-amber-100",
  Resolved: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  Closed: "bg-secondary text-secondary-foreground hover:bg-secondary",
  Disputed: "bg-rose-100 text-rose-700 hover:bg-rose-100",
};
