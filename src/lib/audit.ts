import type { getScopedPrisma, ScopedTx } from "./scoped-prisma";

/**
 * كتابة صف AuditLog حقيقي بعد أي Create/Update — القاعدة غير القابلة للتفاوض في CLAUDE.md.
 * لازم تُستدعى بعد نجاح العملية الأصلية مباشرة، بنفس prisma السياقي (getScopedPrisma()
 * أو tx من withScopedTransaction) عشان RLS (auditlog_insert policy) يتحقق من orgId المستخدم الحالي.
 */
export async function logAudit(
  prisma: Awaited<ReturnType<typeof getScopedPrisma>> | ScopedTx,
  params: {
    orgId: string;
    userId: string;
    action: string;
    entityType: string;
    entityId: string;
    beforeValue?: object;
    afterValue?: object;
  }
) {
  await prisma.auditLog.create({
    data: {
      orgId: params.orgId,
      userId: params.userId,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      beforeValue: params.beforeValue,
      afterValue: params.afterValue,
    },
  });
}
