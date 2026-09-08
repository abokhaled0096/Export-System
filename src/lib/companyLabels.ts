/** تسمية عربية لتصنيف الشركة (Company.classification) — القيم الخام إنجليزية داخليًا
 * (`src/app/companies/actions.ts`)، هنا بس للعرض. */
export const companyClassificationLabel: Record<string, string> = {
  Importer: "مستورد",
  Distributor: "موزّع",
  Wholesaler: "تاجر جملة",
  Retailer: "تاجر تجزئة",
  Processor: "مُصنِّع",
  FoodService: "خدمات طعام",
  Agent: "وكيل",
  Broker: "سمسار",
};

/** تسمية عربية لدور القرار عند جهة الاتصال (Contact.decisionRole). */
export const contactDecisionRoleLabel: Record<string, string> = {
  DecisionMaker: "صاحب القرار",
  EconomicBuyer: "الجهة الممولة",
  TechnicalEvaluator: "المُقيّم الفني",
  User: "مستخدم",
  Procurement: "المشتريات",
  Finance: "المالية",
  Quality: "الجودة",
  Logistics: "اللوجستيات",
  Gatekeeper: "حارس البوابة",
  Influencer: "مؤثّر",
  Champion: "داعم داخلي",
  Opponent: "معارض",
  Unknown: "غير معروف",
};
