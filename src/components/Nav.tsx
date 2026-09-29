import Link from "next/link";
import { getCurrentUser } from "@/lib/session";
import { getPermissionScope } from "@/lib/permissions";
import { getScopedPrisma } from "@/lib/scoped-prisma";
import { logout } from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import NavMobileMenu from "@/components/NavMobileMenu";
import CommandPalette from "@/components/CommandPalette";
import CommandPaletteTrigger from "@/components/CommandPaletteTrigger";

const links = [
  { href: "/", label: "لوحة القيادة" },
  { href: "/products", label: "المنتجات" },
  { href: "/markets", label: "الأسواق" },
  { href: "/analysis", label: "التحليل" },
  { href: "/competitors", label: "المنافسون" },
  { href: "/companies", label: "الشركات" },
  { href: "/opportunities", label: "الفرص" },
  { href: "/deals", label: "الصفقات" },
  { href: "/quote-bundles", label: "حزم عروض الأسعار" },
  { href: "/compliance", label: "الامتثال" },
  { href: "/logistics", label: "اللوجستيات" },
  { href: "/suppliers", label: "الموردين" },
  { href: "/inventory", label: "المخزون" },
  { href: "/capa", label: "CAPA" },
  { href: "/templates", label: "القوالب" },
  { href: "/clauses", label: "البنود" },
  { href: "/lead-rules", label: "توزيع العملاء" },
  { href: "/sales-targets", label: "أهداف المبيعات" },
  { href: "/commission-plans", label: "خطط العمولة" },
  { href: "/accounting/chart-of-accounts", label: "شجرة الحسابات" },
  { href: "/accounting/periods", label: "الفترات المحاسبية" },
  { href: "/accounting/journal-entries", label: "القيود اليومية" },
  { href: "/accounting/trial-balance", label: "ميزان المراجعة" },
  { href: "/accounting/income-statement", label: "قائمة الدخل" },
  { href: "/accounting/balance-sheet", label: "الميزانية العمومية" },
  { href: "/accounting/cost-centers", label: "مراكز التكلفة" },
  { href: "/accounting/profit-centers", label: "مراكز الربحية" },
  { href: "/accounting/bank-accounts", label: "الحسابات البنكية" },
  { href: "/accounting/invoices", label: "الفواتير" },
  { href: "/accounting/payments", label: "الدفعات" },
  { href: "/accounting/receivables", label: "أعمار الذمم" },
  { href: "/accounting/reconciliations", label: "المطابقات البنكية" },
  { href: "/accounting/loans", label: "القروض" },
  { href: "/accounting/cash-flow", label: "التدفّق النقدي" },
  { href: "/accounting/fixed-assets", label: "الأصول الثابتة" },
  { href: "/accounting/depreciation", label: "الإهلاك الدوري" },
  { href: "/accounting/fx-revaluation", label: "فروق العملة" },
  { href: "/accounting/budgets", label: "الموازنات" },
  { href: "/accounting/tax-records", label: "الضرائب" },
  { href: "/governance/sod-rules", label: "فصل المهام" },
  { href: "/governance/decisions", label: "سجل القرارات" },
  { href: "/governance/risks", label: "سجل المخاطر" },
  { href: "/governance/kpis", label: "مؤشرات الأداء" },
  { href: "/governance/change-requests", label: "طلبات تعديل البيانات" },
  { href: "/governance/field-permissions", label: "صلاحيات الحقول" },
  { href: "/governance/workflow-definitions", label: "انتقالات المراحل" },
  { href: "/notifications", label: "الإشعارات" },
];

export default async function Nav() {
  const user = await getCurrentUser();
  const isRoleAdmin = user?.role.name === "Admin" || user?.role.name === "CompanyOwner";
  const canApprove = user ? Boolean(await getPermissionScope(user.roleId, "Approval", "Approve")) : false;
  // العدّاد ده بيتحسب بس لو المستخدم أصلًا يقدر يعتمد قرارات — عشان محدش يستحمّل استعلام إضافي
  // على كل صفحة (Nav بيترسم في كل صفحة) من غير داعي.
  const pendingApprovalsCount = canApprove
    ? await (await getScopedPrisma()).approval.count({ where: { orgId: user!.orgId, decision: "Pending" } })
    : 0;

  const canViewLogistics = user ? Boolean(await getPermissionScope(user.roleId, "Shipment", "View")) : false;
  // عدد الشحنات "محتاجة انتباه" — استثناء لوجستي مفتوح بخطورة عالية/حرجة، أو تجاوز حراري مسجَّل.
  // نفس منطق pendingApprovalsCount فوق: بيتحسب بس لو المستخدم أصلًا يقدر يشوف اللوجستيات.
  let logisticsAttentionCount = 0;
  if (canViewLogistics) {
    const scopedPrisma = await getScopedPrisma();
    const criticalExceptions = await scopedPrisma.logisticsException.findMany({
      where: { orgId: user!.orgId, status: { in: ["Open", "InProgress"] }, severity: { in: ["High", "Critical"] } },
      select: { shipmentId: true },
      distinct: ["shipmentId"],
    });
    const excursions = await scopedPrisma.temperatureLog.findMany({
      where: { orgId: user!.orgId, isExcursion: true },
      select: { shipmentId: true },
      distinct: ["shipmentId"],
    });
    logisticsAttentionCount = new Set([...criticalExceptions.map((e) => e.shipmentId), ...excursions.map((e) => e.shipmentId)]).size;
  }

  // Command Palette (Cmd/Ctrl+K) — نفس روابط القائمة المرئية بالظبط بعد فلترة الصلاحيات هنا،
  // بلا قائمة مستقلة ممكن تنحرف عن صلاحيات الوصول الفعلية.
  const paletteLinks = [
    ...links,
    ...(canApprove ? [{ href: "/approvals", label: "الموافقات" }] : []),
    ...(isRoleAdmin
      ? [
          { href: "/admin/users", label: "الأدوار" },
          { href: "/admin/audit-log", label: "سجل التدقيق" },
          { href: "/admin/teams", label: "الفرق" },
          { href: "/admin/errors", label: "الأخطاء" },
          { href: "/admin/ai-settings", label: "إعدادات AI" },
          { href: "/admin/accounting-settings", label: "إعدادات المحاسبة" },
        ]
      : []),
  ];

  return (
    <>
      {user && <CommandPalette links={paletteLinks} />}
      <header className="relative border-b border-border bg-background">
        <div className="mx-auto flex max-w-5xl items-center gap-6 px-6 py-4">
          <Link href="/" className="shrink-0 font-semibold tracking-wide text-primary">
            ELHEIBALAND
          </Link>
          {user && <CommandPaletteTrigger />}
          {user && (
            <nav className="hidden gap-1 md:flex">
              {links.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  {l.label}
                  {l.href === "/logistics" && logisticsAttentionCount > 0 && (
                    <Badge className="h-5 min-w-5 justify-center bg-rose-600 px-1 text-white hover:bg-rose-600">
                      {logisticsAttentionCount}
                    </Badge>
                  )}
                </Link>
              ))}
              {canApprove && (
                <Link
                  href="/approvals"
                  className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  الموافقات
                  {pendingApprovalsCount > 0 && (
                    <Badge className="h-5 min-w-5 justify-center bg-rose-600 px-1 text-white hover:bg-rose-600">
                      {pendingApprovalsCount}
                    </Badge>
                  )}
                </Link>
              )}
              {isRoleAdmin && (
                <Link
                  href="/admin/users"
                  className="rounded-lg px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  الأدوار
                </Link>
              )}
              {isRoleAdmin && (
                <Link
                  href="/admin/audit-log"
                  className="rounded-lg px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  سجل التدقيق
                </Link>
              )}
              {isRoleAdmin && (
                <Link
                  href="/admin/teams"
                  className="rounded-lg px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  الفرق
                </Link>
              )}
              {isRoleAdmin && (
                <Link
                  href="/admin/errors"
                  className="rounded-lg px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  الأخطاء
                </Link>
              )}
              {isRoleAdmin && (
                <Link
                  href="/admin/ai-settings"
                  className="rounded-lg px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  إعدادات AI
                </Link>
              )}
              {isRoleAdmin && (
                <Link
                  href="/admin/accounting-settings"
                  className="rounded-lg px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  إعدادات المحاسبة
                </Link>
              )}
            </nav>
          )}
          {user && (
            <div className="ms-auto hidden items-center gap-3 md:flex">
              <Link href="/account/mfa" className="text-sm text-muted-foreground hover:text-foreground">
                {user.fullName} <span className="text-xs text-muted-foreground/70">({user.role.name})</span>
              </Link>
              <form action={logout}>
                <Button type="submit" variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive">
                  خروج
                </Button>
              </form>
            </div>
          )}
          {user && (
            <NavMobileMenu
              links={links}
              canApprove={canApprove}
              pendingApprovalsCount={pendingApprovalsCount}
              logisticsAttentionCount={logisticsAttentionCount}
              isRoleAdmin={Boolean(isRoleAdmin)}
              userLabel={`${user.fullName} (${user.role.name})`}
              onLogout={logout}
            />
          )}
        </div>
      </header>
    </>
  );
}
