import type { ScopedTx } from "./scoped-prisma";
import type { PermissionAction } from "@/generated/prisma/enums";

/** إشعار مباشر لمستخدم واحد معروف (زي "تم اعتماد طلبك"). بيتخطّى حساب معطّل بصمت (isActive) —
 * مقدّم الطلب ممكن يتعطّل حسابه بعد التقديم وقبل القرار، وإشعار حساب معطّل صف ميت محدش هيشوفه
 * (اتكشف بمراجعة كود 8 سبتمبر). */
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
  const recipient = await tx.user.findUnique({ where: { id: params.userId }, select: { isActive: true } });
  if (!recipient?.isActive) return;
  await tx.notification.create({ data: { ...params } });
}

/** إشعار لكل المستخدمين النشطين في المنظمة اللي عندهم صلاحية resource.action معيّنة — للاستخدام
 * وقت إنشاء طلب محتاج معتمِد (Approval/MasterDataChangeRequest)، بلا معرفة مين بالظبط هيعتمده مقدّمًا.
 * ⚠️ الفلترة هنا على مستوى الصلاحية بس (resource+action)، بلا اعتبار لـRolePermission.scope
 * (Own/Team/Org) — دلوقتي ده مطابق تمامًا لسلوك approveRequest/rejectRequest/
 * decideMasterDataChangeRequestAction نفسهم، اللي بيقبلوا قرار من أي حامل صلاحية بغض النظر عن
 * الـscope (مفيش assertOwnScope عليهم خالص، راجع src/app/approvals/actions.ts). لو الإنفاذ ده
 * اتضاف لاحقًا (مثلاً SalesManager يعتمد بس طلبات فريقه)، لازم الفلترة هنا تتحدّث معاه بالتوازي —
 * وإلا هيوصل إشعار لمستخدم مش هيقدر يتصرف في الطلب فعليًا (اتكشف بمراجعة كود 8 سبتمبر). */
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

/** تسمية عربية مفهومة لنوع طلب الموافقة الاستثنائية — نفس التصنيف المعروض فعليًا في
 * /approvals (src/app/approvals/page.tsx)، بدل ما الإشعار يعرض القيمة الداخلية الخام
 * (زي "Quote.unitPrice_override") اللي مفيش معنى واضح ليها لمستخدم عادي. */
const APPROVAL_SUBJECT_TYPE_LABELS: Record<string, string> = {
  "Quote.unitPrice_override": "تجاوز السعر الأدنى (walkAwayPrice) في عرض سعر",
  "Gate.waiver": "تجاوز بوابة امتثال",
  "PurchaseOrder.unitPrice_override": "تجاوز الحد الأقصى لسعر الشراء",
};

/** إشعار كل حاملي Approval.Approve بطلب موافقة استثنائية جديد — نفس الاستدعاء كان متكررًا
 * بالحرف في 3 أماكن (createQuote في deals/actions.ts، requestGateWaiver في compliance/actions.ts،
 * طلب تجاوز سقف السعر في sourcing/actions.ts) — نفس فئة generatePoNumber في
 * src/lib/purchaseOrder.ts (كانت متكررة بالحرف في 3 أماكن)، اتصلحت بمراجعة كود 8 سبتمبر. */
export async function notifyApprovers(
  tx: ScopedTx,
  params: { orgId: string; requesterId: string; approvalId: string; subjectType: string }
): Promise<void> {
  await notifyUsersWithPermission(tx, {
    orgId: params.orgId,
    resource: "Approval",
    action: "Approve",
    excludeUserId: params.requesterId,
    notificationType: "approval.requested",
    title: "طلب موافقة استثنائية جديد",
    body: APPROVAL_SUBJECT_TYPE_LABELS[params.subjectType] ?? params.subjectType,
    relatedEntityType: "Approval",
    relatedEntityId: params.approvalId,
  });
}

/** إشعار كل حاملي MasterDataChangeRequest.Edit بطلب اعتماد بيانات أساسية جديد — نفس الاستدعاء
 * كان متكررًا بالحرف في مكانين (requestEntityCreation في src/lib/masterDataChangeRequest.ts،
 * createMasterDataChangeRequest في governance/actions.ts). */
export async function notifyChangeRequestApprovers(
  tx: ScopedTx,
  params: { orgId: string; requesterId: string; requestId: string; entityType: string }
): Promise<void> {
  await notifyUsersWithPermission(tx, {
    orgId: params.orgId,
    resource: "MasterDataChangeRequest",
    action: "Edit",
    excludeUserId: params.requesterId,
    notificationType: "changeRequest.requested",
    title: "طلب اعتماد بيانات أساسية جديد",
    body: `نوع الكيان: ${params.entityType}`,
    relatedEntityType: "MasterDataChangeRequest",
    relatedEntityId: params.requestId,
  });
}
