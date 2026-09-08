/** خريطة الحسابات القياسية بالأكواد (مش UUIDs) — بتتحل لـids وقت الترحيل بـresolveAccountIds()
 * في src/lib/accounting.ts. v1 مقصودة: خريطة ثابتة موثّقة بدل جدول تكوين. نظام ناضج بيخلّيها
 * قابلة للتعديل من الواجهة — مسجّل في BACKLOG.md. الأكواد دي مزروعة في prisma/seed.ts
 * (STANDARD_CHART_OF_ACCOUNTS).
 *
 * ملف منفصل عمدًا (بدل تعريفها جوه accounting.ts) — src/lib/budget.ts محتاج الخريطة دي، و
 * accounting.ts محتاج checkBudgetAlerts من budget.ts، فتعريفها هنا بيمنع استيراد دائري
 * (accounting.ts ↔ budget.ts) كان هيخلّي GL_ACCOUNTS undefined وقت تحميل budget.ts. */
export const GL_ACCOUNTS = {
  CASH: "1010",
  AR: "1020",
  VAT_INPUT: "1040",
  AP: "2010",
  VAT_OUTPUT: "2030",
  LOANS_PAYABLE: "2040",
  REVENUE: "4010",
  INTEREST_INCOME: "4020",
  COGS: "5010",
  BANK_CHARGES: "6040",
  INTEREST_EXPENSE: "6050",
  ACCUMULATED_DEPRECIATION: "1050",
  FIXED_ASSETS_COST: "1060",
  DEPRECIATION_EXPENSE: "6060",
  ASSET_DISPOSAL_GAIN_LOSS: "7010",
  SALES_COMMISSIONS: "6020",
} as const;
