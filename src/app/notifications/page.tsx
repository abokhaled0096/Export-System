import { requireCurrentUser } from "@/lib/session";
import { requirePermission } from "@/lib/permissions";
import { getScopedPrisma } from "@/lib/scoped-prisma";
import MarkReadButton from "./MarkReadButton";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { notificationTypeLabel } from "@/lib/notification";

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
  const unreadCount = notifications.filter((n) => !n.readAt).length;

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">الإشعارات</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {notifications.length} إشعار — {unreadCount} غير مقروء
        </p>
      </div>

      <div className="mt-6 space-y-2">
        {notifications.length === 0 ? (
          <p className="rounded-xl border border-border bg-card px-4 py-6 text-center text-muted-foreground">
            مفيش إشعارات لسه.
          </p>
        ) : (
          notifications.map((n) => (
            <div
              key={n.id}
              className={`flex items-start justify-between gap-4 rounded-xl border p-4 ${n.readAt ? "border-border bg-card" : "border-primary/40 bg-primary/5"}`}
            >
              <div>
                <div className="flex items-center gap-2">
                  {!n.readAt && <Badge className="bg-primary text-primary-foreground hover:bg-primary">جديد</Badge>}
                  <span className="text-xs text-muted-foreground">{notificationTypeLabel[n.notificationType] ?? n.notificationType}</span>
                </div>
                <p className="mt-1 font-medium text-foreground">{n.title}</p>
                {n.body && <p className="mt-1 text-sm text-muted-foreground">{n.body}</p>}
                <p className="mt-1 text-xs text-muted-foreground">{n.createdAt.toISOString().slice(0, 16).replace("T", " ")}</p>
              </div>
              {!n.readAt && <MarkReadButton notificationId={n.id} />}
            </div>
          ))
        )}
      </div>
    </main>
  );
}
