import { z } from "zod";

const LEAD_SOURCE_TYPES = [
  "GoogleSearch", "GoogleMaps", "LinkedIn", "CompanyDirectory", "TradeFair", "ChamberOfCommerce",
  "IndustryAssociation", "GovernmentSite", "CommercialRegistry", "TradePlatform", "ShippingData",
  "TenderSite", "Referral", "ExistingCustomer", "Supplier", "Embassy", "ImporterList",
  "CompanyWebsite", "SocialMedia", "ManualEntry",
] as const;

/** مفصولة عن src/app/companies/actions.ts لأنها "use server" file، وملفات "use server" في
 * Next.js الحديث ممنوع تصدّر غير async functions — الـschema ده بيتستخدم كمان في
 * src/app/governance/actions.ts (إعادة تحقق MasterDataChangeRequest)، فمحتاج ملف منفصل. */
export const CompanySchema = z.object({
  legalName: z.string().trim().min(2, "الاسم القانوني مطلوب"),
  tradeName: z.string().trim().optional(),
  country: z.string().trim().min(1, "الدولة مطلوبة"),
  city: z.string().trim().optional(),
  classification: z.string().trim().min(1, "اختر تصنيف واحد على الأقل"),
  /// مصدر العميل — مواصفة مشروع ٣ §٩. اختياري في الـschema عشان ما نكسرش مسارات
  /// الإنشاء القايمة (استيراد CSV، طلبات تعديل البيانات)، بس الفورم بيطلبه.
  leadSourceType: z.enum(LEAD_SOURCE_TYPES).optional().or(z.literal("")),
  leadSourceDetail: z.string().trim().optional(),
});

/** أنواع المصادر — مواصفة مشروع ٣ §٩ «أنواع المصادر» حرفيًا (٢٠ نوع). */
export const LEAD_SOURCE_TYPE_LABEL: Record<string, string> = {
  GoogleSearch: "بحث Google",
  GoogleMaps: "خرائط Google",
  LinkedIn: "LinkedIn",
  CompanyDirectory: "دليل شركات",
  TradeFair: "معرض",
  ChamberOfCommerce: "غرفة تجارة",
  IndustryAssociation: "جمعية صناعية",
  GovernmentSite: "موقع حكومي",
  CommercialRegistry: "سجل تجاري",
  TradePlatform: "منصة تجارة دولية",
  ShippingData: "بيانات شحن",
  TenderSite: "موقع مناقصات",
  Referral: "إحالة",
  ExistingCustomer: "عميل حالي",
  Supplier: "مورّد",
  Embassy: "سفارة",
  ImporterList: "قائمة مستوردين",
  CompanyWebsite: "موقع الشركة",
  SocialMedia: "سوشيال ميديا",
  ManualEntry: "إدخال يدوي",
};
