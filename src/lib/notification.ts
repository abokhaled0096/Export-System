import type { ScopedTx } from "./scoped-prisma";
import type { PermissionAction } from "@/generated/prisma/enums";

/** إشعار مباشر لمستخدم واحد معروف (زي "تم اعتماد طلبك"). */
export async function notifyUser(
  tx: ScopedTx,
  params: {
    orgId: string;
    userId: string;
    notificationType: string;
    title: string;
    body?: string;
    relatedEntityType?: string;
    relatedEntityId?: string;
  }
): Promise<void> {
  await tx.notification.create({ data: { ...params } });
}

/** إشعار لكل المستخدمين النشطين في المنظمة اللي عندهم صلاحية resource.action معيّنة — للاستخدام
 * وقت إنشاء طلب محتاج معتمِد (Approval/MasterDataChangeRequest)، بلا معرفة مين بالظبط هيعتمده مقدّمًا. */
export async function notifyUsersWithPermission(
  tx: ScopedTx,
  params: {
    orgId: string;
    resource: string;
    action: PermissionAction;
    excludeUserId?: string;
    notificationType: string;
    title: string;
    body?: string;
    relatedEntityType?: string;
    relatedEntityId?: string;
  }
): Promise<void> {
  const recipients = await tx.user.findMany({
    where: {
      orgId: params.orgId,
      isActive: true,
      ...(params.excludeUserId ? { id: { not: params.excludeUserId } } : {}),
      role: { rolePermissions: { some: { permission: { resource: params.resource, action: params.action } } } },
    },
    select: { id: true },
  });
  if (recipients.length === 0) return;
  await tx.notification.createMany({
    data: recipients.map((r) => ({
      orgId: params.orgId,
      userId: r.id,
      notificationType: params.notificationType,
      title: params.title,
      body: params.body,
      relatedEntityType: params.relatedEntityType,
      relatedEntityId: params.relatedEntityId,
    })),
  });
}
