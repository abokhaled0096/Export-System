import Link from "next/link";
import { getCurrentUser } from "@/lib/session";
import { getPermissionScope } from "@/lib/permissions";
import { getScopedPrisma } from "@/lib/scoped-prisma";
import { logout } from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import NavMobileMenu from "@/components/NavMobileMenu";
import NavSectionMenu from "@/components/NavSectionMenu";
import CommandPalette from "@/components/CommandPalette";
import CommandPaletteTrigger from "@/components/CommandPaletteTrigger";
import { navSections, adminLinks, allSectionLinks, setupLink } from "@/lib/navigation";

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

  // عدّادات التنبيه بتتمرّر بالـhref عشان القسم يجمّعها ويعرضها على الزرار، والرابط نفسه
  // يعرض بتاعه — بدل ما كل رابط يتعالج بشرط خاص في الـJSX زي الأول.
  const badges: Record<string, number> = { "/logistics": logisticsAttentionCount };

  // الموافقات قسم قائم بذاته لأنها "مطلوب منك قرار دلوقتي" — مش وحدة وظيفية.
  const approvalLinks = canApprove ? [{ href: "/approvals", label: "الموافقات" }] : [];
  if (canApprove) badges["/approvals"] = pendingApprovalsCount;

  // Command Palette (Cmd/Ctrl+K) — نفس روابط القائمة المرئية بالظبط بعد فلترة الصلاحيات هنا،
  // بلا قائمة مستقلة ممكن تنحرف عن صلاحيات الوصول الفعلية.
  const paletteLinks = [
    { href: "/", label: "لوحة القيادة" },
    ...allSectionLinks,
    { href: "/notifications", label: "الإشعارات" },
    setupLink,
    ...approvalLinks,
    ...(isRoleAdmin ? adminLinks : []),
  ];

  return (
    <>
      {user && <CommandPalette links={paletteLinks} />}
      <header className="relative border-b border-border bg-background">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-6 py-4">
          <Link href="/" className="shrink-0 font-semibold tracking-wide text-primary">
            ELHEIBALAND
          </Link>
          {user && <CommandPaletteTrigger />}
          {user && (
            <nav className="hidden items-center gap-0.5 md:flex">
              <Link
                href="/"
                className="rounded-lg px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                لوحة القيادة
              </Link>
              {navSections.map((section) => (
                <NavSectionMenu key={section.id} label={section.label} links={section.links} badges={badges} />
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
              {isRoleAdmin && <NavSectionMenu label="الإدارة" links={adminLinks} />}
            </nav>
          )}
          {user && (
            <div className="ms-auto hidden items-center gap-3 md:flex">
              <Link href="/notifications" className="text-sm text-muted-foreground hover:text-foreground">
                الإشعارات
              </Link>
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
              sections={navSections}
              adminLinks={isRoleAdmin ? adminLinks : []}
              approvalLinks={approvalLinks}
              badges={badges}
              userLabel={`${user.fullName} (${user.role.name})`}
              onLogout={logout}
            />
          )}
        </div>
      </header>
    </>
  );
}
