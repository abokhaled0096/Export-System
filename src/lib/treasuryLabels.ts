import { Prisma } from "@/generated/prisma/client";

export const exchangeRateTypeLabel: Record<string, string> = {
  Spot: "فوري",
  Budget: "موازنة",
  Contracted: "تعاقدي",
  Actual: "فعلي",
};

export const bankTransactionTypeLabel: Record<string, string> = {
  Deposit: "إيداع",
  Withdrawal: "سحب",
  TransferIn: "تحويل وارد",
  TransferOut: "تحويل صادر",
  Charge: "مصروف بنكي",
  Interest: "فائدة دائنة",
};

/** أنواع الحركات اللي بتزوّد الرصيد. المرجع الوحيد للاتجاه في طبقة التطبيق — بيقابل
 * دالة `bank_transaction_signed_amount()` في القاعدة بالحرف. `amount` موجب دايمًا
 * (مفروض بـTrigger)، والاتجاه بيتشتق من النوع مش من إشارة المبلغ. */
const INFLOW_TYPES = new Set(["Deposit", "TransferIn", "Interest"]);

export function isInflow(transactionType: string): boolean {
  return INFLOW_TYPES.has(transactionType);
}

/** المبلغ بإشارته حسب اتجاه الحركة — الأساس لحساب الرصيد الجاري وأي تجميع. */
export function signedAmount(transactionType: string, amount: Prisma.Decimal): Prisma.Decimal {
  return isInflow(transactionType) ? amount : amount.neg();
}

export const reconciliationStatusLabel: Record<string, string> = {
  InProgress: "جارية",
  Reconciled: "مُطابَقة",
  Discrepancy: "بها فروق",
};

export const reconciliationStatusStyle: Record<string, string> = {
  InProgress: "bg-amber-100 text-amber-700 hover:bg-amber-100",
  Reconciled: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  Discrepancy: "bg-rose-100 text-rose-700 hover:bg-rose-100",
};

export const loanStatusLabel: Record<string, string> = {
  Active: "قائم",
  Settled: "مسدَّد",
  Defaulted: "متعثّر",
};

export const loanStatusStyle: Record<string, string> = {
  Active: "bg-sky-100 text-sky-700 hover:bg-sky-100",
  Settled: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  Defaulted: "bg-rose-100 text-rose-700 hover:bg-rose-100",
};

export const loanInstallmentStatusLabel: Record<string, string> = {
  Pending: "مستحق",
  Paid: "مسدَّد",
};

export const cashFlowCategoryLabel: Record<string, string> = {
  OpeningCash: "الرصيد الافتتاحي",
  CustomerCollections: "تحصيلات العملاء",
  SupplierPayments: "مدفوعات الموردين",
  Payroll: "الرواتب",
  Freight: "الشحن",
  Customs: "الجمارك",
  Taxes: "الضرائب",
  LoanService: "خدمة القروض",
  Capex: "استثمارات رأسمالية",
  ClosingCash: "الرصيد الختامي",
};

/** الفئات اللي المستخدم بيدخّلها يدويًا. OpeningCash/ClosingCash مستبعدين لأنهم **أرصدة
 * محسوبة مش تدفّقات** — تخزينهم كصفوف بيدّي ازدواج حساب في أي تجميع (مفروض بـTrigger كمان). */
export const MANUAL_CASH_FLOW_CATEGORIES = [
  "CustomerCollections",
  "SupplierPayments",
  "Payroll",
  "Freight",
  "Customs",
  "Taxes",
  "LoanService",
  "Capex",
] as const;

/** الفئات اللي بتمثّل خروج نقدية — بتتعرض بالسالب في شبكة التدفّق. */
const OUTFLOW_CATEGORIES = new Set(["SupplierPayments", "Payroll", "Freight", "Customs", "Taxes", "LoanService", "Capex"]);

export function isCashOutflowCategory(category: string): boolean {
  return OUTFLOW_CATEGORIES.has(category);
}

/** بداية الأسبوع (الإتنين) بتوقيت UTC للتاريخ ده. الشبكة كلها مبنية على الإتنين، والـTrigger
 * بيرفض أي `weekStartDate` مش إتنين — من غير كده الأسابيع بتتداخل والشبكة بتبوظ. */
export function mondayOf(date: Date): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const isoDay = d.getUTCDay() === 0 ? 7 : d.getUTCDay();
  d.setUTCDate(d.getUTCDate() - (isoDay - 1));
  return d;
}

/** 13 أسبوع متتالي ابتداءً من أسبوع التاريخ المُعطى — أفق التخطيط النقدي القياسي. */
export function thirteenWeeksFrom(start: Date): Date[] {
  const first = mondayOf(start);
  return Array.from({ length: 13 }, (_, i) => {
    const d = new Date(first);
    d.setUTCDate(d.getUTCDate() + i * 7);
    return d;
  });
}

/**
 * مفتاح الأسبوع — **قيمة مش نص للعرض**، ولازم تفضل ISO (yyyy-mm-dd).
 *
 * ⚠️ الناتج ده بيتبعت كقيمة `weekStartDate` في فورم التدفّق النقدي وبيتقري في
 * `createCashFlowForecastLine` بـ`new Date(weekStartDate)`. أي صيغة تانية (زي dd/mm/yyyy)
 * بتدّي `Invalid Date` وتكتب تاريخ باظ في القاعدة. للعرض استخدم `formatDate()` على
 * الـ`Date` الأصلي — مش على المفتاح ده.
 */
export function weekKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** القسط متأخر = مستحق + تاريخ استحقاقه عدّى. حالة زمنية بتتحسب وقت العرض مش مخزَّنة
 * (نفس علاج `Invoice.Overdue` — أي حالة زمنية مخزَّنة بتبقى قديمة لحظة كتابتها). */
export function isInstallmentOverdue(status: string, dueDate: Date): boolean {
  return status === "Pending" && dueDate.getTime() < Date.now();
}

// ==================== وحدة 8 — الشريحة الرابعة والأخيرة: الموازنات والأصول والضرائب ====================

export const budgetTypeLabel: Record<string, string> = {
  Sales: "مبيعات",
  Purchase: "مشتريات",
  OPEX: "مصروفات تشغيلية",
  CAPEX: "استثمارات رأسمالية",
  Cash: "نقدية",
};

export const fixedAssetCategoryLabel: Record<string, string> = {
  Equipment: "معدات",
  Vehicle: "مركبات",
  Furniture: "أثاث",
  Building: "مباني",
  ComputerHardware: "أجهزة حاسوب",
  Other: "أخرى",
};

export const fixedAssetStatusLabel: Record<string, string> = {
  Active: "نشط",
  Disposed: "متباع",
  Impaired: "منعدم القيمة",
};

export const fixedAssetStatusStyle: Record<string, string> = {
  Active: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  Disposed: "bg-secondary text-secondary-foreground hover:bg-secondary",
  Impaired: "bg-rose-100 text-rose-700 hover:bg-rose-100",
};

export const depreciationMethodLabel: Record<string, string> = {
  StraightLine: "القسط الثابت",
  DecliningBalance: "القسط المتناقص",
};

export const taxTypeLabel: Record<string, string> = {
  VATOutput: "ض.ق.م — مبيعات (مخرجات)",
  VATInput: "ض.ق.م — مشتريات (مدخلات)",
  WithholdingTax: "ضريبة خصم منبع",
  PayrollTax: "ضريبة مرتبات",
};

export const taxFilingStatusLabel: Record<string, string> = {
  NotFiled: "لسه ما اتقدمش",
  Filed: "مُقدَّم",
  Paid: "مسدَّد",
};

export const taxFilingStatusStyle: Record<string, string> = {
  NotFiled: "bg-secondary text-secondary-foreground hover:bg-secondary",
  Filed: "bg-amber-100 text-amber-700 hover:bg-amber-100",
  Paid: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
};

/** أنواع الضريبة اللي ليها حساب GL مخصص وبيتحسب رصيدها من الدفتر تلقائيًا (1040/2030).
 * الباقي (خصم منبع/مرتبات) بيتسجّل يدويًا لحد ما يتضاف لهم حساب مخصص — راجع BACKLOG.md. */
export const GL_BACKED_TAX_TYPES = ["VATInput", "VATOutput"] as const;

export function isGlBackedTax(taxType: string): boolean {
  return (GL_BACKED_TAX_TYPES as readonly string[]).includes(taxType);
}
