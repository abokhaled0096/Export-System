import type { ScopedTx } from "./scoped-prisma";

/**
 * محرك انتقال المراحل العام (وحدة 9، WorkflowDefinition — راجع STATUS.md، 7 سبتمبر). بيحل
 * محل خرائط TS ثابتة كانت متكررة (OPPORTUNITY_STAGE_TRANSITIONS، CAPA_STATUS_TRANSITIONS) —
 * الفرق إن كل منظمة تقدر تخصّص انتقالاتها من /governance/workflow-definitions بلا تعديل كود.
 *
 * ⚠️ طبقة تطبيقية إضافية فوق أي Trigger موجود، مش بديل عنه — القيود الحرجة الحالية
 * (enforce_opportunity_rfq_before_quote، enforce_capa_verification) فاضلة زي ما هي بالحرف.
 */
/**
 * الكيانات اللي **فعلًا** بتعدّي على المحرك (يعني بتنادي `assertWorkflowTransitionAllowed`).
 *
 * ⚠️ شاشة `/governance/workflow-definitions` كانت بتقول «Opportunity وCAPA حاليًا» وهي
 * مكتوبة من وقت ما كانوا اتنين بس — بقوا **١١**. الكلام القديم كان بيقلّل من قيمة الميزة
 * ويخلّي المستخدم يفتكر إن جداول Claim/AccountingPeriod مالهاش لازمة، فمايصنّهاش، وبعدين
 * يتمنع من انتقال بسبب صف ناقص في جدول هو فاكره مهمَل. (اتكشف 1 أكتوبر.)
 *
 * القايمة دي **متحروسة باختبار** في prisma/statements-test.ts بيفحص الكود الفعلي —
 * فلو حد ضاف نداء لكيان جديد ونسي يحدّثها، الاختبار بيفشل.
 */
export const WORKFLOW_ENFORCED_ENTITY_TYPES = [
  "AccountingPeriod",
  "CAPA",
  "Claim",
  "Gate",
  "LogisticsException",
  "Milestone",
  "Opportunity",
  "OriginProof",
  "Product",
  "Requirement",
  "RiskRegisterItem",
] as const;

export async function findWorkflowDefinition(
  tx: ScopedTx,
  orgId: string,
  entityType: string,
  fromStage: string,
  toStage: string
) {
  return tx.workflowDefinition.findUnique({
    where: { orgId_entityType_fromStage_toStage: { orgId, entityType, fromStage, toStage } },
  });
}

/**
 * بيرمي لو الانتقال مش معرَّف في الجدول أصلًا، أو معرَّف لكن محتاج موافقة معتمَدة (Approval
 * بـsubjectType: `${entityType}.stageTransition`، subjectId: entityId، decision: "Approved")
 * لسه مش موجودة.
 */
export async function assertWorkflowTransitionAllowed(
  tx: ScopedTx,
  orgId: string,
  entityType: string,
  entityId: string,
  fromStage: string,
  toStage: string
) {
  const definition = await findWorkflowDefinition(tx, orgId, entityType, fromStage, toStage);
  if (!definition) {
    throw new Error(`مينفعش الانتقال من "${fromStage}" لـ"${toStage}" مباشرة.`);
  }
  if (definition.requiredApprovalPolicyId) {
    const approval = await tx.approval.findFirst({
      where: { orgId, subjectType: `${entityType}.stageTransition`, subjectId: entityId, decision: "Approved" },
    });
    if (!approval) {
      throw new Error("الانتقال ده محتاج موافقة معتمَدة الأول — اطلب موافقة استثنائية.");
    }
  }
}
