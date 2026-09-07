// بذر البيانات الأساسية — صف Organization واحد مزروع، بلا أي واجهة إدارة مستأجرين
// (قرار معماري محسوم، راجع CLAUDE.md وSTATUS.md §multi-tenancy)، + الأدوار التسعة الافتراضية
// لوحدة 9 (RBAC، راجع migration 20260827120000_rbac_foundation لنفس منطق البذر).
// Idempotent بالكامل: يشتغل أكتر من مرة من غير ما يكرر أي صف.
import "dotenv/config";
import { prisma } from "../src/lib/prisma";

const SYSTEM_ROLES = [
  "SalesRep",
  "SalesManager",
  "Finance",
  "ComplianceOfficer",
  "ProcurementOfficer",
  "QualityManager",
  "LogisticsOfficer",
  "CompanyOwner",
  "Admin",
] as const;

/** كتالوج الصلاحيات الفعلي المُطبَّق في Server Actions دلوقتي (راجع BACKLOG.md P0 — تفعيل RBAC).
 * مقصود يفضل صغير ومطابق للي موجود فعلًا في الكود، مش تعداد نظري لكل احتمال مستقبلي. */
const PERMISSIONS: { resource: string; action: "View" | "Create" | "Edit" | "Delete" | "Approve" | "Export" | "Import" }[] = [
  { resource: "Product", action: "Create" },
  { resource: "Product", action: "Edit" },
  { resource: "Product", action: "View" }, // صفحة تفاصيل /products/[id] جديدة — وحدة 4 الشريحة الأولى
  { resource: "ProductSpecification", action: "Create" }, // وحدة 4 — الشريحة الأولى (31 أغسطس/1 سبتمبر)
  { resource: "CAPA", action: "Create" }, // كيان مشترك — صفحة /capa جديدة (1 سبتمبر)
  { resource: "CAPA", action: "View" },
  { resource: "CAPA", action: "Edit" }, // تدفّق Verify/Close (2 سبتمبر)
  { resource: "Market", action: "Create" },
  { resource: "Market", action: "Edit" }, // أرشفة/استعادة سوق — راجع BACKLOG.md § خلصان (30 أغسطس)
  { resource: "Market", action: "View" }, // صفحة تفاصيل /markets/[id] جديدة (6 سبتمبر) — مراجعة وحدة 1
  { resource: "Company", action: "Create" },
  { resource: "Company", action: "View" }, // فلترة Own scope على قائمة /companies — راجع BACKLOG.md
  { resource: "Company", action: "Edit" }, // أرشفة/استعادة شركة
  { resource: "Contact", action: "Create" },
  { resource: "Opportunity", action: "Create" },
  { resource: "Opportunity", action: "View" }, // فلترة Own scope على قائمة /opportunities
  { resource: "Opportunity", action: "Edit" }, // أرشفة/استعادة فرصة
  { resource: "Analysis", action: "Create" },
  { resource: "Analysis", action: "View" }, // مراجعة وحدة 1 (6 سبتمبر) — كان مفيش صلاحية عرض خالص لـ/analysis
  { resource: "Competitor", action: "Create" }, // بحث آلي أو إدخال يدوي لمنافسين حقيقيين (6 سبتمبر)
  { resource: "Competitor", action: "View" },
  { resource: "Deal", action: "Create" },
  { resource: "Deal", action: "View" }, // فلترة Own scope على لوحة /deals
  { resource: "Deal", action: "Edit" },
  { resource: "DealScenario", action: "Create" },
  { resource: "DealScenario", action: "Edit" },
  { resource: "CostItem", action: "Create" },
  { resource: "RiskItem", action: "Create" },
  { resource: "Quote", action: "Create" },
  { resource: "Quote", action: "Approve" }, // قبول عرض السعر (acceptQuote) — التزام مالي، مش SalesRep عادي
  { resource: "QuoteBundle", action: "Create" }, // تجميع عروض أسعار مستقلة (نفس العميل) في مستند واحد
  { resource: "QuoteBundle", action: "View" },
  { resource: "Document", action: "Create" }, // وحدة 4 — الشريحة الثانية (1 سبتمبر)
  { resource: "DocumentPackage", action: "Create" }, // وحدة 4 — إقفال أخير (1 سبتمبر)
  { resource: "DocumentVersion", action: "Create" },
  { resource: "Template", action: "Create" },
  { resource: "Template", action: "View" },
  { resource: "Clause", action: "Create" },
  { resource: "Clause", action: "View" },
  { resource: "Communication", action: "Create" }, // وحدة 3 — شريحة أولى (1 سبتمبر)
  { resource: "RFQAnalysis", action: "Create" },
  { resource: "CustomerSample", action: "Create" },
  { resource: "Negotiation", action: "Create" },
  { resource: "NegotiationRound", action: "Create" },
  { resource: "RedFlag", action: "Create" },
  { resource: "LeadAssignmentRule", action: "Create" }, // وحدة 3 — إقفال أخير (1 سبتمبر)
  { resource: "LeadAssignmentRule", action: "View" },
  { resource: "SalesTarget", action: "Create" },
  { resource: "SalesTarget", action: "View" },
  { resource: "CommissionPlan", action: "Create" },
  { resource: "CommissionPlan", action: "View" },
  { resource: "CommissionEntry", action: "Create" },
  { resource: "CommissionEntry", action: "View" },
  { resource: "CommissionEntry", action: "Edit" }, // اعتماد + سداد (2 سبتمبر)
  { resource: "CustomerServiceCase", action: "Create" },
  { resource: "CustomerServiceCase", action: "View" },
  // وحدة 8 — الحسابات والخزينة، الشريحة الأولى: دفتر الأستاذ الأساسي (1 سبتمبر).
  { resource: "ChartOfAccount", action: "Create" },
  { resource: "ChartOfAccount", action: "View" },
  { resource: "AccountingPeriod", action: "Create" },
  { resource: "AccountingPeriod", action: "View" },
  { resource: "AccountingPeriod", action: "Edit" }, // قفل الفترة (Open→SoftClosed→HardClosed)
  { resource: "JournalEntry", action: "Create" },
  { resource: "JournalEntry", action: "View" },
  { resource: "JournalEntry", action: "Edit" }, // ترحيل القيد (Draft→Posted)
  { resource: "CostCenter", action: "Create" },
  { resource: "CostCenter", action: "View" },
  { resource: "ProfitCenter", action: "Create" },
  { resource: "ProfitCenter", action: "View" },
  // وحدة 8 — الشريحة التانية: AR/AP (1 سبتمبر).
  { resource: "BankAccount", action: "Create" },
  { resource: "BankAccount", action: "View" },
  { resource: "BankAccount", action: "Edit" }, // واجهة إدخال بيانات الحساب المشفّرة (5 سبتمبر) — أول Edit فعلي على BankAccount

  { resource: "Invoice", action: "Create" },
  { resource: "Invoice", action: "View" },
  { resource: "Invoice", action: "Edit" }, // إصدار/إلغاء الفاتورة
  { resource: "Payment", action: "Create" },
  { resource: "Payment", action: "View" },
  { resource: "Payment", action: "Edit" }, // تحصيل/سداد/ارتداد + تخصيص على فواتير
  // وحدة 8 — الشريحة التالتة: الخزينة والبنوك (1 سبتمبر).
  { resource: "BankTransaction", action: "Create" },
  { resource: "BankTransaction", action: "View" },
  { resource: "BankTransaction", action: "Import" }, // استيراد كشف حساب CSV بالجملة — خطر مختلف عن إدخال حركة واحدة، صلاحية مستقلة عمدًا
  { resource: "BankReconciliation", action: "Create" },
  { resource: "BankReconciliation", action: "View" },
  { resource: "BankReconciliation", action: "Edit" }, // مضاهاة الحركات + إقفال المطابقة
  { resource: "Loan", action: "Create" },
  { resource: "Loan", action: "View" },
  { resource: "Loan", action: "Edit" }, // صرف القرض + سداد الأقساط
  { resource: "CashFlowForecastLine", action: "Create" },
  { resource: "CashFlowForecastLine", action: "View" },
  // وحدة 8 — الشريحة الرابعة والأخيرة: الموازنات والأصول والضرائب (2 سبتمبر).
  { resource: "Budget", action: "Create" },
  { resource: "Budget", action: "View" },
  { resource: "FixedAsset", action: "Create" },
  { resource: "FixedAsset", action: "View" },
  { resource: "FixedAsset", action: "Edit" }, // تسجيل التخلص من أصل
  { resource: "DepreciationEntry", action: "Create" }, // تشغيل الإهلاك الدوري
  { resource: "DepreciationEntry", action: "View" },
  { resource: "TaxRecord", action: "Create" },
  { resource: "TaxRecord", action: "View" },
  { resource: "TaxRecord", action: "Edit" }, // اعتماد الإقرار + تسجيل السداد
  // وحدة 9 — الشريحة التانية: الحوكمة والإدارة (2 سبتمبر).
  { resource: "SegregationOfDutyRule", action: "Create" },
  { resource: "SegregationOfDutyRule", action: "View" },
  { resource: "DecisionLogEntry", action: "Create" },
  { resource: "DecisionLogEntry", action: "View" },
  { resource: "RiskRegisterItem", action: "Create" },
  { resource: "RiskRegisterItem", action: "View" },
  { resource: "RiskRegisterItem", action: "Edit" }, // تحويل حالة (Open→Mitigated→Closed)
  { resource: "KPI", action: "Create" },
  { resource: "KPI", action: "View" },
  { resource: "Notification", action: "View" }, // scope: Own — كل الأدوار
  { resource: "Notification", action: "Edit" }, // تعليم كمقروء
  { resource: "MasterDataChangeRequest", action: "Create" },
  { resource: "MasterDataChangeRequest", action: "View" },
  { resource: "MasterDataChangeRequest", action: "Edit" }, // اعتماد/رفض
  { resource: "SalesOrder", action: "Edit" }, // تأكيد أمر البيع بـPO (confirmSalesOrder)
  { resource: "User", action: "Edit" }, // تعيين الأدوار — شاشة /admin/users
  { resource: "Approval", action: "Approve" }, // قرار موافقة/رفض استثنائية — شاشة /approvals
  { resource: "AuditLog", action: "View" }, // عرض سجل التدقيق — شاشة /admin/audit-log
  { resource: "Contact", action: "Export" }, // PDPL — تصدير بيانات جهة اتصال (حق الوصول)
  { resource: "Contact", action: "Delete" }, // PDPL — محو حقيقي (Anonymization) لبيانات جهة اتصال
  // وحدة 5 — الامتثال والجمارك (شريحة أولى، 30 أغسطس، راجع docs/SCOPE-P5.md).
  { resource: "ComplianceCase", action: "Create" },
  { resource: "ComplianceCase", action: "View" },
  { resource: "ComplianceCase", action: "Edit" },
  { resource: "Requirement", action: "Create" },
  { resource: "Requirement", action: "Edit" }, // تحديث حالة متطلب (Met/NotMet/...)
  { resource: "Gate", action: "Create" },
  { resource: "Gate", action: "Edit" }, // قرار مباشر (Passed/Failed/NotApplicable) أو طلب تجاوز (Waiver)
  { resource: "HSClassification", action: "Create" },
  { resource: "Certificate", action: "Create" },
  { resource: "Registration", action: "Create" },
  { resource: "OriginProof", action: "Create" },
  { resource: "OriginProof", action: "Edit" }, // تحديث revisedRulesWordingVerified/رقم الشهادة بعد الإصدار الأول (2 سبتمبر)
  { resource: "RejectionCase", action: "Create" },
  { resource: "LCRequirement", action: "Create" },
  // وحدة 6 — اللوجستيات (شريحة أولى، 30 أغسطس، راجع STATUS.md).
  { resource: "Shipment", action: "Create" },
  { resource: "Shipment", action: "View" },
  { resource: "Shipment", action: "Edit" },
  { resource: "Booking", action: "Create" },
  { resource: "Container", action: "Create" },
  { resource: "Milestone", action: "Edit" }, // تحديث حالة معلم (Completed/Delayed/...)
  // وحدة 6 — الشريحة الثانية (التتبع التشغيلي، 30 أغسطس).
  { resource: "ShipmentEvent", action: "Create" },
  { resource: "LogisticsException", action: "Create" },
  { resource: "LogisticsException", action: "Edit" }, // تحديث حالة استثناء لوجستي
  { resource: "FreeTimeRecord", action: "Create" },
  { resource: "ActualLogisticsCost", action: "Create" },
  // وحدة 6 — الشريحة الثالثة (30 أغسطس).
  { resource: "TemperatureLog", action: "Create" },
  { resource: "TransportTrip", action: "Create" },
  { resource: "TransportTrip", action: "Edit" }, // واجهة إدخال driverPhone مشفّرة (5 سبتمبر) — أول Edit فعلي على TransportTrip

  { resource: "Claim", action: "Create" },
  { resource: "Claim", action: "Edit" }, // تحديث حالة المطالبة
  // وحدة 6 — الشريحة الرابعة والأخيرة (تسعير الشحن، 30 أغسطس).
  { resource: "ServiceProvider", action: "Create" },
  { resource: "ServiceProvider", action: "View" },
  { resource: "Route", action: "Create" },
  { resource: "Route", action: "View" },
  { resource: "FreightQuote", action: "Create" },
  { resource: "FreightQuote", action: "View" },
  { resource: "FreightQuoteLine", action: "Create" },
  { resource: "ShipmentLot", action: "Create" }, // إقفال وحدة 6 (17/17) — محتاج Lot من وحدة 7
  // وحدة 7 — التوريد والإنتاج والجودة (الشريحة الأولى، 30 أغسطس).
  { resource: "Supplier", action: "Create" },
  { resource: "Supplier", action: "View" },
  { resource: "Supplier", action: "Edit" }, // واجهة إدخال بيانات بنكية مشفّرة (4 سبتمبر) — أول Edit فعلي على Supplier

  { resource: "Facility", action: "Create" },
  { resource: "SourcingRequest", action: "Create" },
  { resource: "SourcingRequest", action: "View" },
  { resource: "SupplierQuote", action: "Create" },
  { resource: "PurchaseOrder", action: "Create" },
  { resource: "PurchaseOrder", action: "View" }, // صفحة تفاصيل /purchase-orders/[id] — وحدة 7 الشريحة الثانية
  // وحدة 7 — الإنتاج والجودة الأساسية (الشريحة الثانية، 31 أغسطس).
  { resource: "Batch", action: "Create" },
  { resource: "Batch", action: "View" },
  { resource: "Inspection", action: "Create" },
  { resource: "QualityRelease", action: "Create" },
  { resource: "Lot", action: "Create" },
  { resource: "Lot", action: "View" },
  // وحدة 7 — الشريحة الثالثة (تخطيط الإنتاج/المخزون/الجودة التكميلية، 31 أغسطس).
  { resource: "ProductionPlan", action: "Create" },
  { resource: "ProductionPlan", action: "View" },
  { resource: "Inventory", action: "Create" },
  { resource: "Inventory", action: "View" },
  { resource: "NCR", action: "Create" },
  { resource: "LabTest", action: "Create" },
  // وحدة 7 — الشريحة الرابعة (تتبّع زراعي/RFQ/أهلية أسواق، 31 أغسطس).
  { resource: "Farm", action: "Create" },
  { resource: "Farm", action: "View" },
  { resource: "SupplierRFQ", action: "Create" },
  { resource: "BatchRawMaterialLine", action: "Create" },
  { resource: "BatchMarketEligibility", action: "Create" },
  // وحدة 7 — الشريحة الخامسة والأخيرة (إقفال 23/23، 31 أغسطس).
  { resource: "SupplierAudit", action: "Create" },
  { resource: "SupplyContract", action: "Create" },
  { resource: "PackagingMaterial", action: "Create" },
  { resource: "SupplierSample", action: "Create" },
  { resource: "SupplierPerformance", action: "Create" },
  { resource: "CargoReadiness", action: "Create" },
  // وحدة 9 — إكمال 13/13 (FieldPermission/WorkflowDefinition، 7 سبتمبر). Admin/CompanyOwner
  // بس (Org scope عبر FULL_ACCESS_RESOURCES تحت) — إدارة صلاحيات/انتقالات على مستوى المنظمة.
  { resource: "FieldPermission", action: "View" },
  { resource: "FieldPermission", action: "Create" },
  { resource: "FieldPermission", action: "Delete" },
  { resource: "WorkflowDefinition", action: "View" },
  { resource: "WorkflowDefinition", action: "Create" },
  { resource: "WorkflowDefinition", action: "Delete" },
];

/** كل الصلاحيات الفوق، Org scope — Admin وCompanyOwner بيمسكوا كل حاجة. */
const FULL_ACCESS_RESOURCES = PERMISSIONS.map((p) => `${p.resource}.${p.action}`);

const SALES_PIPELINE_ORG_SCOPE = [
  "Company.Create",
  "Company.View",
  "Company.Edit",
  "Contact.Create",
  "Opportunity.Create",
  "Opportunity.View",
  "Opportunity.Edit",
  "Product.View", // مراجعة وحدة 1 (6 سبتمبر) — SalesManager كان عنده Product.Create/Edit بلا Product.View خالص، يعني /products/[id] كانت فعليًا معطّلة عليه
  "Market.View",
  "Analysis.Create",
  "Analysis.View", // مراجعة وحدة 1 (6 سبتمبر) — مفيش صلاحية عرض كانت موجودة لـ/analysis أصلًا
  "Competitor.Create",
  "Competitor.View",
  "Deal.Create",
  "Deal.View",
  "Deal.Edit",
  "DealScenario.Create",
  "DealScenario.Edit",
  "CostItem.Create",
  "RiskItem.Create",
  "Quote.Create",
  "Quote.Approve",
  "QuoteBundle.Create",
  "QuoteBundle.View",
  "SalesOrder.Edit",
  "Document.Create",
  "DocumentPackage.Create",
  "DocumentVersion.Create",
  "Template.Create",
  "Template.View",
  "Clause.Create",
  "Clause.View",
  "Communication.Create",
  "RFQAnalysis.Create",
  "CustomerSample.Create",
  "Negotiation.Create",
  "NegotiationRound.Create",
  "RedFlag.Create",
  "LeadAssignmentRule.Create",
  "LeadAssignmentRule.View",
  "SalesTarget.Create",
  "SalesTarget.View",
  "CommissionPlan.Create",
  "CommissionPlan.View",
  "CommissionEntry.Create",
  "CommissionEntry.View",
  "CommissionEntry.Edit",
  "CustomerServiceCase.Create",
  "CustomerServiceCase.View",
];

const SALES_PIPELINE_OWN_SCOPE = [
  "Company.Create",
  "Company.View",
  "Company.Edit",
  "Contact.Create",
  "Opportunity.Create",
  "Opportunity.View",
  "Opportunity.Edit",
  "Product.View", // مراجعة وحدة 1 (6 سبتمبر) — SalesRep محتاج يشوف تفاصيل المنتج وقت التسعير/التحليل
  "Market.View",
  "Analysis.Create",
  "Analysis.View",
  "Competitor.Create",
  "Competitor.View",
  "Deal.Create",
  "Deal.View",
  "Deal.Edit",
  "DealScenario.Create",
  "DealScenario.Edit",
  "CostItem.Create",
  "RiskItem.Create",
  "Quote.Create",
  "QuoteBundle.Create",
  "QuoteBundle.View",
  "Document.Create",
  "DocumentPackage.Create",
  "DocumentVersion.Create",
  "Template.Create",
  "Template.View",
  "Clause.Create",
  "Clause.View",
  "Communication.Create",
  "RFQAnalysis.Create",
  "CustomerSample.Create",
  "Negotiation.Create",
  "NegotiationRound.Create",
  "RedFlag.Create",
  "CustomerServiceCase.Create",
  "CustomerServiceCase.View",
  // ملحوظة: مفيش Quote.Approve ولا SalesOrder.Edit — SalesRep يقدر يعمل عرض سعر، مش يقفله ماليًا.
  // ملحوظة: مفيش LeadAssignmentRule/SalesTarget/CommissionPlan/CommissionEntry — كيانات إدارية/تكوينية لـSalesManager بس.
];

// وحدة 5 — موارد الامتثال، بتتضاف لـSalesManager (بتاع فريقه) وComplianceOfficer (Org — لسه
// مفيش ownerId على ComplianceCase نفسه يبرر Own/Team، الملف مرتبط بصفقة مش بمستخدم واحد).
const COMPLIANCE_RESOURCES = [
  "ComplianceCase.Create",
  "ComplianceCase.View",
  "ComplianceCase.Edit",
  "Requirement.Create",
  "Requirement.Edit",
  "Gate.Create",
  "Gate.Edit",
  "HSClassification.Create",
  "Certificate.Create",
  "Registration.Create",
  "OriginProof.Create",
  "OriginProof.Edit",
  "RejectionCase.Create",
  "LCRequirement.Create",
  "CAPA.Create",
  "CAPA.View",
  "CAPA.Edit",
];

// وحدة 6 — موارد اللوجستيات (شريحة أولى)، لدور LogisticsOfficer (أول استخدام فعلي له، كان
// موجود في SYSTEM_ROLES بلا صلاحيات لحد 30 أغسطس، نفس نمط ComplianceOfficer).
const LOGISTICS_RESOURCES = [
  "Shipment.Create",
  "Shipment.View",
  "Shipment.Edit",
  "Booking.Create",
  "Container.Create",
  "Milestone.Edit",
  "ShipmentEvent.Create",
  "LogisticsException.Create",
  "LogisticsException.Edit",
  "FreeTimeRecord.Create",
  "ActualLogisticsCost.Create",
  "TemperatureLog.Create",
  "TransportTrip.Create",
  "TransportTrip.Edit",
  "Claim.Create",
  "Claim.Edit",
  "ServiceProvider.Create",
  "ServiceProvider.View",
  "Route.Create",
  "Route.View",
  "FreightQuote.Create",
  "FreightQuote.View",
  "FreightQuoteLine.Create",
  "ShipmentLot.Create", // إقفال وحدة 6 (17/17) — راجع docs/SCOPE-P6.md
];

// وحدة 7 — موارد التوريد (الشريحة الأولى)، لدور ProcurementOfficer (أول استخدام فعلي له، كان
// موجود في SYSTEM_ROLES بلا صلاحيات لحد 30 أغسطس، نفس نمط LogisticsOfficer/ComplianceOfficer).
const PROCUREMENT_RESOURCES = [
  "Supplier.Create",
  "Supplier.View",
  "Supplier.Edit",
  "Facility.Create",
  "SourcingRequest.Create",
  "SourcingRequest.View",
  "SupplierQuote.Create",
  "PurchaseOrder.Create",
  "PurchaseOrder.View",
  "Batch.Create",
  "Batch.View",
  "ProductionPlan.Create",
  "ProductionPlan.View",
  "Inventory.Create",
  "Inventory.View",
  "Farm.Create",
  "Farm.View",
  "SupplierRFQ.Create",
  "SupplyContract.Create",
  "PackagingMaterial.Create",
  "SupplierPerformance.Create",
  "CargoReadiness.Create",
  "Product.View",
  "ProductSpecification.Create",
];

// وحدة 7 — الإنتاج والجودة الأساسية (الشريحة الثانية)، أول استخدام فعلي لدور QualityManager
// (كان موجود في SYSTEM_ROLES بلا صلاحيات، آخر دور متبقي بلا استخدام — راجع docs/SCOPE-P7.md).
const QUALITY_RESOURCES = [
  "Batch.View",
  "Inspection.Create",
  "QualityRelease.Create",
  "Lot.Create",
  "Lot.View",
  "LabTest.Create",
  "NCR.Create",
  "BatchRawMaterialLine.Create",
  "BatchMarketEligibility.Create",
  "SupplierAudit.Create",
  "SupplierSample.Create",
  "Product.View",
  "ProductSpecification.Create",
  "CAPA.Create",
  "CAPA.View",
  "CAPA.Edit",
];

/** الأدوار وصلاحياتها — [قايمة "resource.action"، الـscope]. */
const ROLE_GRANTS: Record<string, { resources: string[]; scope: "Own" | "Team" | "Org" }> = {
  Admin: { resources: FULL_ACCESS_RESOURCES, scope: "Org" },
  CompanyOwner: { resources: FULL_ACCESS_RESOURCES, scope: "Org" },
  // Team scope — مطابق لـdocs/ERD.md §13 ("SalesManager بتاع فريقه")، مش Org كامل.
  // بيتفلتر عبر User.teamId (راجع src/lib/permissions.ts: scopedOwnerIdFilter/assertOwnScope).
  SalesManager: {
    resources: [
      ...SALES_PIPELINE_ORG_SCOPE,
      "Product.Create",
      "Product.Edit",
      "Market.Create",
      "Market.Edit",
      ...COMPLIANCE_RESOURCES,
    ],
    scope: "Team",
  },
  SalesRep: { resources: SALES_PIPELINE_OWN_SCOPE, scope: "Own" },
  Finance: {
    resources: [
      "SalesOrder.Edit",
      "ChartOfAccount.Create",
      "ChartOfAccount.View",
      "AccountingPeriod.Create",
      "AccountingPeriod.View",
      "AccountingPeriod.Edit",
      "JournalEntry.Create",
      "JournalEntry.View",
      "JournalEntry.Edit",
      "CostCenter.Create",
      "CostCenter.View",
      "ProfitCenter.Create",
      "ProfitCenter.View",
      "BankAccount.Create",
      "BankAccount.View",
      "BankAccount.Edit",
      "Invoice.Create",
      "Invoice.View",
      "Invoice.Edit",
      "Payment.Create",
      "Payment.View",
      "Payment.Edit",
      "BankTransaction.Create",
      "BankTransaction.View",
      "BankTransaction.Import",
      "BankReconciliation.Create",
      "BankReconciliation.View",
      "BankReconciliation.Edit",
      "Loan.Create",
      "Loan.View",
      "Loan.Edit",
      "CashFlowForecastLine.Create",
      "CashFlowForecastLine.View",
      "Budget.Create",
      "Budget.View",
      "FixedAsset.Create",
      "FixedAsset.View",
      "FixedAsset.Edit",
      "DepreciationEntry.Create",
      "DepreciationEntry.View",
      "TaxRecord.Create",
      "TaxRecord.View",
      "TaxRecord.Edit",
    ],
    scope: "Org",
  },
  // أول استخدام فعلي لدور ComplianceOfficer (موجود في SYSTEM_ROLES بلا صلاحيات لحد 30 أغسطس).
  ComplianceOfficer: { resources: COMPLIANCE_RESOURCES, scope: "Org" },
  LogisticsOfficer: { resources: LOGISTICS_RESOURCES, scope: "Org" },
  ProcurementOfficer: { resources: PROCUREMENT_RESOURCES, scope: "Org" },
  QualityManager: { resources: QUALITY_RESOURCES, scope: "Org" },
};

// الموافقة على تجاوز walkAwayPrice/Gate.waiver/maximumPurchasePrice — مسؤولية إدارية، متاحة لنفس
// الأدوار اللي بتاخد قرارات مالية/امتثال/توريد حساسة (نفس مسار /approvals الموجود، بلا صلاحية جديدة).
ROLE_GRANTS.SalesManager.resources.push("Approval.Approve");
ROLE_GRANTS.Finance.resources.push("Approval.Approve");
ROLE_GRANTS.ComplianceOfficer.resources.push("Approval.Approve");
ROLE_GRANTS.ProcurementOfficer.resources.push("Approval.Approve");

// وحدة 9 — الشريحة التانية (2 سبتمبر). Notification شخصية بطبيعتها — كل الأدوار التسعة
// بتاخدها (الفلترة بـuserId جوه الصفحة نفسها، مش بالـscope العام للدور).
for (const role of SYSTEM_ROLES) {
  if (role === "Admin" || role === "CompanyOwner") continue; // عندهم بالفعل عبر FULL_ACCESS_RESOURCES
  ROLE_GRANTS[role].resources.push("Notification.View", "Notification.Edit");
}

// سجل القرارات/المخاطر/مؤشرات الأداء — نطاق إشرافي/إداري (نفس الأدوار اللي بتاخد قرارات حساسة).
ROLE_GRANTS.Finance.resources.push("DecisionLogEntry.Create", "DecisionLogEntry.View", "RiskRegisterItem.Create", "RiskRegisterItem.View", "RiskRegisterItem.Edit", "KPI.Create", "KPI.View");
ROLE_GRANTS.SalesManager.resources.push("DecisionLogEntry.Create", "DecisionLogEntry.View", "RiskRegisterItem.Create", "RiskRegisterItem.View", "RiskRegisterItem.Edit", "KPI.Create", "KPI.View");
ROLE_GRANTS.ComplianceOfficer.resources.push("DecisionLogEntry.Create", "DecisionLogEntry.View", "RiskRegisterItem.Create", "RiskRegisterItem.View", "RiskRegisterItem.Edit");

// طلب تعديل بيانات أساسية — متاح لأي دور بيصنع بيانات أساسية؛ الاعتماد (Edit) لـAdmin/CompanyOwner بس.
ROLE_GRANTS.Finance.resources.push("MasterDataChangeRequest.Create", "MasterDataChangeRequest.View");
ROLE_GRANTS.ProcurementOfficer.resources.push("MasterDataChangeRequest.Create", "MasterDataChangeRequest.View");
ROLE_GRANTS.SalesManager.resources.push("MasterDataChangeRequest.Create", "MasterDataChangeRequest.View");

/** شجرة حسابات قياسية مبدئية — وحدة 8 الشريحة الأولى (1 سبتمبر). ترقيم احترافي معتاد
 * (1000s أصول، 2000s خصوم، 3000s حقوق ملكية، 4000s إيرادات، 5000s تكلفة مبيعات، 6000s مصروفات)
 * مناسب لشركة تصدير تجاري — نقطة بداية قابلة للتوسع من شاشة /accounting/chart-of-accounts، مش
 * قائمة نهائية. */
const STANDARD_CHART_OF_ACCOUNTS: {
  code: string;
  nameAr: string;
  nameEn: string;
  type: "Asset" | "Liability" | "Equity" | "Revenue" | "COGS" | "Expense";
  normalBalance: "Debit" | "Credit";
  parentCode?: string;
}[] = [
  { code: "1000", nameAr: "الأصول", nameEn: "Assets", type: "Asset", normalBalance: "Debit" },
  { code: "1010", nameAr: "النقدية وما يعادلها", nameEn: "Cash and Cash Equivalents", type: "Asset", normalBalance: "Debit", parentCode: "1000" },
  { code: "1020", nameAr: "حسابات مدينة — عملاء", nameEn: "Accounts Receivable", type: "Asset", normalBalance: "Debit", parentCode: "1000" },
  { code: "1030", nameAr: "المخزون", nameEn: "Inventory", type: "Asset", normalBalance: "Debit", parentCode: "1000" },
  // ض.ق.م — اتضافوا مع شريحة AR/AP (1 سبتمبر): Invoice.taxAmount مكانش ليه حساب يترحّل ليه.
  { code: "1040", nameAr: "ضريبة قيمة مضافة — مشتريات", nameEn: "VAT Input", type: "Asset", normalBalance: "Debit", parentCode: "1000" },
  // اتضاف مع شريحة الموازنات/الأصول/الضرائب (2 سبتمبر): حساب مقابل (contra-asset) إلزامي
  // محاسبيًا لمجمّع الإهلاك — من غيره القيمة الدفترية الصافية مالهاش حساب تترحّل ضده.
  { code: "1050", nameAr: "مجمّع إهلاك الأصول الثابتة", nameEn: "Accumulated Depreciation", type: "Asset", normalBalance: "Credit", parentCode: "1000" },
  // الأصول الثابتة بتكلفتها — من غيره التخلص من أصل مالوش حساب يتشطب منه (اتلقطت وقت بناء الترحيل).
  { code: "1060", nameAr: "الأصول الثابتة بالتكلفة", nameEn: "Fixed Assets at Cost", type: "Asset", normalBalance: "Debit", parentCode: "1000" },
  { code: "2000", nameAr: "الخصوم", nameEn: "Liabilities", type: "Liability", normalBalance: "Credit" },
  { code: "2010", nameAr: "حسابات دائنة — موردين", nameEn: "Accounts Payable", type: "Liability", normalBalance: "Credit", parentCode: "2000" },
  { code: "2020", nameAr: "مصروفات مستحقة", nameEn: "Accrued Expenses", type: "Liability", normalBalance: "Credit", parentCode: "2000" },
  { code: "2030", nameAr: "ضريبة قيمة مضافة — مبيعات", nameEn: "VAT Output", type: "Liability", normalBalance: "Credit", parentCode: "2000" },
  // اتضاف مع شريحة الخزينة (1 سبتمبر): صرف القرض وسداد أصله محتاجين حساب التزام.
  { code: "2040", nameAr: "قروض دائنة", nameEn: "Loans Payable", type: "Liability", normalBalance: "Credit", parentCode: "2000" },
  { code: "3000", nameAr: "حقوق الملكية", nameEn: "Equity", type: "Equity", normalBalance: "Credit" },
  { code: "3010", nameAr: "رأس المال", nameEn: "Share Capital", type: "Equity", normalBalance: "Credit", parentCode: "3000" },
  { code: "3020", nameAr: "الأرباح المرحّلة", nameEn: "Retained Earnings", type: "Equity", normalBalance: "Credit", parentCode: "3000" },
  { code: "4000", nameAr: "الإيرادات", nameEn: "Revenue", type: "Revenue", normalBalance: "Credit" },
  { code: "4010", nameAr: "إيرادات المبيعات", nameEn: "Sales Revenue", type: "Revenue", normalBalance: "Credit", parentCode: "4000" },
  // اتضاف مع شريحة الخزينة: فوائد دائنة من البنك حدث محاسبي حقيقي محتاج حساب إيراد.
  { code: "4020", nameAr: "إيرادات فوائد", nameEn: "Interest Income", type: "Revenue", normalBalance: "Credit", parentCode: "4000" },
  { code: "5000", nameAr: "تكلفة المبيعات", nameEn: "Cost of Goods Sold", type: "COGS", normalBalance: "Debit" },
  { code: "5010", nameAr: "تكلفة البضاعة المباعة", nameEn: "COGS — Goods", type: "COGS", normalBalance: "Debit", parentCode: "5000" },
  { code: "6000", nameAr: "المصروفات", nameEn: "Expenses", type: "Expense", normalBalance: "Debit" },
  { code: "6010", nameAr: "مصروفات إدارية وعمومية", nameEn: "General & Administrative Expenses", type: "Expense", normalBalance: "Debit", parentCode: "6000" },
  { code: "6020", nameAr: "عمولات المبيعات", nameEn: "Sales Commissions", type: "Expense", normalBalance: "Debit", parentCode: "6000" },
  { code: "6030", nameAr: "مصروفات الشحن والتخليص", nameEn: "Freight & Customs Clearance Expenses", type: "Expense", normalBalance: "Debit", parentCode: "6000" },
  // اتضافوا مع شريحة الخزينة: مصروفات البنك وأعباء تمويل القروض.
  { code: "6040", nameAr: "مصروفات بنكية", nameEn: "Bank Charges", type: "Expense", normalBalance: "Debit", parentCode: "6000" },
  { code: "6050", nameAr: "أعباء تمويل — فوائد قروض", nameEn: "Interest Expense", type: "Expense", normalBalance: "Debit", parentCode: "6000" },
  // اتضافوا مع شريحة الموازنات/الأصول/الضرائب: مصروف الإهلاك الدوري + بند غير تشغيلي
  // لربح/خسارة التخلص من الأصول (خارج شجرة 6000s عمدًا — بند غير تشغيلي مش مصروف تشغيل).
  { code: "6060", nameAr: "مصروف إهلاك", nameEn: "Depreciation Expense", type: "Expense", normalBalance: "Debit", parentCode: "6000" },
  { code: "7010", nameAr: "أرباح وخسائر التخلص من الأصول الثابتة", nameEn: "Gain/Loss on Disposal of Fixed Assets", type: "Expense", normalBalance: "Debit" },
];

async function main() {
  let org = await prisma.organization.findFirst();
  if (org) {
    console.log("✓ Organization موجودة بالفعل:", org.id);
  } else {
    org = await prisma.organization.create({
      data: {
        name: "أبوهيبة للتصدير",
        legalName: "Abu Heiba Export Co.",
        isActive: true,
      },
    });
    console.log("✓ اتزرعت Organization:", org.id);
  }

  const roleByName = new Map<string, string>();
  for (const name of SYSTEM_ROLES) {
    const role = await prisma.role.upsert({
      where: { orgId_name: { orgId: org.id, name } },
      create: { orgId: org.id, name, description: name, isSystemRole: true },
      update: {},
    });
    roleByName.set(name, role.id);
  }
  console.log("✓ الأدوار التسعة الافتراضية موجودة");

  const permissionByKey = new Map<string, string>();
  for (const p of PERMISSIONS) {
    const permission = await prisma.permission.upsert({
      where: { resource_action: { resource: p.resource, action: p.action } },
      create: { resource: p.resource, action: p.action },
      update: {},
    });
    permissionByKey.set(`${p.resource}.${p.action}`, permission.id);
  }
  console.log(`✓ كتالوج الصلاحيات موجود (${PERMISSIONS.length} صلاحية)`);

  let grantCount = 0;
  for (const [roleName, grant] of Object.entries(ROLE_GRANTS)) {
    const roleId = roleByName.get(roleName);
    if (!roleId) continue;
    for (const key of grant.resources) {
      const permissionId = permissionByKey.get(key);
      if (!permissionId) continue;
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId, permissionId } },
        create: { roleId, permissionId, scope: grant.scope },
        update: { scope: grant.scope },
      });
      grantCount++;
    }
  }
  console.log(`✓ صلاحيات الأدوار موجودة (${grantCount} منحة)`);

  // ============ FieldPermission (وحدة 9 — 7 سبتمبر) ============
  // ترحيل حالة إخفاء بيانات التسعير الداخلية (walkAwayPrice/breakEvenPrice/الربح والهامش) عن
  // SalesRep — كان بيتعمل بإعادة استخدام Deal.View scope كـproxy (canSeeInternalPricing).
  // بيتحسب ديناميكيًا من ROLE_GRANTS (مش اسم دور مكتوب يدويًا زي "SalesRep") عشان أي دور
  // مستقبلي بـOwn scope على Deal.View يتغطّى تلقائيًا — نفس فلسفة "fail closed" الأصلية.
  const HIDDEN_DEAL_SCENARIO_FIELDS = ["walkAwayPrice", "breakEvenPrice", "expectedProfit", "expectedMarginPct", "expectedMarkupPct"];
  let fieldPermissionCount = 0;
  for (const [roleName, grant] of Object.entries(ROLE_GRANTS)) {
    if (grant.scope !== "Own" || !grant.resources.includes("Deal.View")) continue;
    const roleId = roleByName.get(roleName);
    if (!roleId) continue;
    for (const fieldName of HIDDEN_DEAL_SCENARIO_FIELDS) {
      await prisma.fieldPermission.upsert({
        where: { roleId_entityType_fieldName: { roleId, entityType: "DealScenario", fieldName } },
        create: { roleId, entityType: "DealScenario", fieldName, accessLevel: "Hidden" },
        update: { accessLevel: "Hidden" },
      });
      fieldPermissionCount++;
    }
  }
  console.log(`✓ صلاحيات الحقول موجودة (${fieldPermissionCount} صلاحية)`);

  // ============ WorkflowDefinition (وحدة 9 — 7 سبتمبر) ============
  // ترحيل الانتقالات المسموحة اللي كانت خرائط TS ثابتة (OPPORTUNITY_STAGE_TRANSITIONS،
  // CAPA_STATUS_TRANSITIONS) لجدول DB — بلا requiredApprovalPolicyId (مفيش سياسة موافقة
  // مربوطة بيهم حاليًا)، وبلا تغيير في السلوك الفعلي.
  const WORKFLOW_TRANSITIONS: { entityType: string; fromStage: string; toStage: string }[] = [
    { entityType: "Opportunity", fromStage: "NewLead", toStage: "Contacted" },
    { entityType: "Opportunity", fromStage: "NewLead", toStage: "Lost" },
    { entityType: "Opportunity", fromStage: "Contacted", toStage: "Qualified" },
    { entityType: "Opportunity", fromStage: "Contacted", toStage: "Lost" },
    { entityType: "Opportunity", fromStage: "Qualified", toStage: "QuoteSent" },
    { entityType: "Opportunity", fromStage: "Qualified", toStage: "Lost" },
    { entityType: "Opportunity", fromStage: "QuoteSent", toStage: "Won" },
    { entityType: "Opportunity", fromStage: "QuoteSent", toStage: "Lost" },
    { entityType: "CAPA", fromStage: "Open", toStage: "InProgress" },
    { entityType: "CAPA", fromStage: "Open", toStage: "VerificationPending" },
    { entityType: "CAPA", fromStage: "InProgress", toStage: "VerificationPending" },
    { entityType: "CAPA", fromStage: "VerificationPending", toStage: "Effective" },
    { entityType: "CAPA", fromStage: "VerificationPending", toStage: "Ineffective" },
    { entityType: "CAPA", fromStage: "Effective", toStage: "Closed" },
    { entityType: "CAPA", fromStage: "Ineffective", toStage: "Closed" },
  ];
  for (const t of WORKFLOW_TRANSITIONS) {
    await prisma.workflowDefinition.upsert({
      where: { orgId_entityType_fromStage_toStage: { orgId: org.id, ...t } },
      create: { orgId: org.id, ...t },
      update: {},
    });
  }
  console.log(`✓ انتقالات المراحل المسموحة موجودة (${WORKFLOW_TRANSITIONS.length} انتقال)`);

  const accountCodeToId = new Map<string, string>();
  let accountCount = 0;
  for (const a of STANDARD_CHART_OF_ACCOUNTS) {
    const parentId = a.parentCode ? accountCodeToId.get(a.parentCode) : undefined;
    const account = await prisma.chartOfAccount.upsert({
      where: { orgId_accountCode: { orgId: org.id, accountCode: a.code } },
      create: {
        orgId: org.id,
        accountCode: a.code,
        nameAr: a.nameAr,
        nameEn: a.nameEn,
        accountType: a.type,
        normalBalance: a.normalBalance,
        parentAccountId: parentId,
      },
      update: {},
    });
    accountCodeToId.set(a.code, account.id);
    accountCount++;
  }
  console.log(`✓ شجرة الحسابات القياسية موجودة (${accountCount} حساب)`);
}

main()
  .catch((e) => {
    console.error("❌ فشل البذر:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
