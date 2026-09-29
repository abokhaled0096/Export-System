/**
 * مصدر واحد لبنية القائمة، مقسّمة لأقسام.
 *
 * قبل كده كانت ~50 لينك مسطحة في `Nav.tsx` متكرّرة يدويًا في `NavMobileMenu` و`CommandPalette`
 * — قايمة بالطول ده بلا تجميع مفيش حد بيقراها، بيمسحها بعينه ويستسلم. التقسيم هنا بيتبع
 * الوحدات التسع في `CLAUDE.md` مش ترتيب البناء.
 *
 * الروابط المحكومة بصلاحية (الموافقات، شاشات الأدمن) مش هنا — بتتضاف في `Nav.tsx` بعد فحص
 * الصلاحية الفعلي، عشان القايمة ما تعرضش حاجة المستخدم مايقدرش يفتحها.
 */

export type NavLink = { href: string; label: string };
export type NavSection = { id: string; label: string; links: NavLink[] };

export const navSections: NavSection[] = [
  {
    id: "commercial",
    label: "تجاري",
    links: [
      { href: "/products", label: "المنتجات" },
      { href: "/markets", label: "الأسواق" },
      { href: "/analysis", label: "التحليل" },
      { href: "/competitors", label: "المنافسون" },
      { href: "/companies", label: "الشركات" },
      { href: "/opportunities", label: "الفرص" },
      { href: "/deals", label: "الصفقات" },
      { href: "/quote-bundles", label: "حزم عروض الأسعار" },
      { href: "/templates", label: "القوالب" },
      { href: "/clauses", label: "البنود" },
    ],
  },
  {
    id: "operations",
    label: "تشغيل",
    links: [
      { href: "/compliance", label: "الامتثال" },
      { href: "/logistics", label: "اللوجستيات" },
      { href: "/suppliers", label: "الموردين" },
      { href: "/inventory", label: "المخزون" },
      { href: "/capa", label: "CAPA" },
    ],
  },
  {
    id: "sales",
    label: "فريق المبيعات",
    links: [
      { href: "/lead-rules", label: "توزيع العملاء" },
      { href: "/sales-targets", label: "أهداف المبيعات" },
      { href: "/commission-plans", label: "خطط العمولة" },
    ],
  },
  {
    id: "finance",
    label: "مالي",
    links: [
      // القوائم المالية الأول — دي اللي بتتفتح كل يوم، مش شجرة الحسابات.
      { href: "/accounting/income-statement", label: "قائمة الدخل" },
      { href: "/accounting/balance-sheet", label: "الميزانية العمومية" },
      { href: "/accounting/trial-balance", label: "ميزان المراجعة" },
      { href: "/accounting/invoices", label: "الفواتير" },
      { href: "/accounting/payments", label: "الدفعات" },
      { href: "/accounting/receivables", label: "أعمار الذمم" },
      { href: "/accounting/cash-flow", label: "التدفّق النقدي" },
      { href: "/accounting/bank-accounts", label: "الحسابات البنكية" },
      { href: "/accounting/reconciliations", label: "المطابقات البنكية" },
      { href: "/accounting/journal-entries", label: "القيود اليومية" },
      { href: "/accounting/chart-of-accounts", label: "شجرة الحسابات" },
      { href: "/accounting/periods", label: "الفترات المحاسبية" },
      { href: "/accounting/budgets", label: "الموازنات" },
      { href: "/accounting/tax-records", label: "الضرائب" },
      { href: "/accounting/fixed-assets", label: "الأصول الثابتة" },
      { href: "/accounting/depreciation", label: "الإهلاك الدوري" },
      { href: "/accounting/fx-revaluation", label: "فروق العملة" },
      { href: "/accounting/loans", label: "القروض" },
      { href: "/accounting/cost-centers", label: "مراكز التكلفة" },
      { href: "/accounting/profit-centers", label: "مراكز الربحية" },
    ],
  },
  {
    id: "governance",
    label: "حوكمة",
    links: [
      { href: "/governance/decisions", label: "سجل القرارات" },
      { href: "/governance/risks", label: "سجل المخاطر" },
      { href: "/governance/kpis", label: "مؤشرات الأداء" },
      { href: "/governance/sod-rules", label: "فصل المهام" },
      { href: "/governance/change-requests", label: "طلبات تعديل البيانات" },
      { href: "/governance/field-permissions", label: "صلاحيات الحقول" },
      { href: "/governance/workflow-definitions", label: "انتقالات المراحل" },
    ],
  },
];

/** روابط الأدمن — بتتعرض بس لو المستخدم Admin/CompanyOwner. */
export const adminLinks: NavLink[] = [
  { href: "/admin/users", label: "الأدوار" },
  { href: "/admin/teams", label: "الفرق" },
  { href: "/admin/audit-log", label: "سجل التدقيق" },
  { href: "/admin/errors", label: "الأخطاء" },
  { href: "/admin/ai-settings", label: "إعدادات AI" },
  { href: "/admin/accounting-settings", label: "إعدادات المحاسبة" },
];

/** كل روابط الأقسام مفرودة — للبحث السريع (Cmd/Ctrl+K). */
export const allSectionLinks: NavLink[] = navSections.flatMap((s) => s.links);
