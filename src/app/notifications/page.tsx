import { requireCurrentUser } from "@/lib/session";
import { requirePermission } from "@/lib/permissions";
import { getScopedPrisma } from "@/lib/scoped-prisma";
import NotificationList from "./NotificationList";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const user = await requireCurrentUser();

  try {
    await requirePermission(user.roleId, "Notification", "View");
  } catch {
    return (
      <main className="mx-auto max-w-3xl px-6 py-10">
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-6 text-center text-sm text-destructive">
          معندكش صلاحية الوصول للصفحة دي.
        </div>
      </main>
    );
  }

  const prisma = await getScopedPrisma();
  // ⚠️ فلترة صريحة بـuserId — إشعارات المستخدم الحالي بس، مش كل إشعارات المنظمة (Notification
  // مالهوش scope حقيقي في RolePermission، الفلترة هنا هي الـOwn الفعلي).
  const notifications = await prisma.notification.findMany({
    where: { orgId: user.orgId, userId: user.id },
    orderBy: { createdAt: "desc" },
  });

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="text-2xl font-semibold text-foreground">الإشعارات</h1>
      <NotificationList
        notifications={notifications.map((n) => ({
          id: n.id,
          notificationType: n.notificationType,
          title: n.title,
          body: n.body,
          createdAt: n.createdAt.toISOString(),
          readAt: n.readAt?.toISOString() ?? null,
        }))}
      />
    </main>
  );
}
