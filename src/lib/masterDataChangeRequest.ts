import type { ScopedTx } from "./scoped-prisma";
import { logAudit } from "./audit";
import { notifyChangeRequestApprovers } from "./notification";

/** entityId لطلبات "إنشاء كيان جديد" (عكس طلبات تعديل كيان موجود، اللي بتحمل الـid الحقيقي).
 * `MasterDataChangeRequest.entityId` عمدًا مش @db.Uuid في الـSchema — نص حر، فالقيمة دي آمنة. */
export const NEW_ENTITY_SENTINEL = "NEW";

/**
 * تسجيل طلب إنشاء كيان جديد (Company/Supplier/BankAccount) بدل الإنشاء المباشر — للمستخدم
 * اللي معندوش صلاحية {Entity}.Create بس عنده MasterDataChangeRequest.Create. الطلب بيتحوّل
 * لكيان حقيقي فعليًا وقت الاعتماد (راجع decideMasterDataChangeRequestAction في
 * src/app/governance/actions.ts) — مش تسجيل شكلي بلا أثر زي ما كان قبل كده.
 */
export async function requestEntityCreation(
  tx: ScopedTx,
  params: { orgId: string; userId: string; entityType: string; proposedChanges: object }
): Promise<void> {
  const request = await tx.masterDataChangeRequest.create({
    data: {
      orgId: params.orgId,
      entityType: params.entityType,
      entityId: NEW_ENTITY_SENTINEL,
      proposedChanges: params.proposedChanges,
      requestedBy: params.userId,
    },
  });
  await logAudit(tx, {
    orgId: params.orgId,
    userId: params.userId,
    action: "masterDataChangeRequest.created",
    entityType: "MasterDataChangeRequest",
    entityId: request.id,
    afterValue: { entityType: params.entityType, entityId: NEW_ENTITY_SENTINEL, proposedChanges: params.proposedChanges },
  });
  await notifyChangeRequestApprovers(tx, {
    orgId: params.orgId,
    requesterId: params.userId,
    requestId: request.id,
    entityType: params.entityType,
  });
}
