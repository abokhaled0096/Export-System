import type { ScopedTx } from "@/lib/scoped-prisma";
import { logAudit } from "@/lib/audit";

/**
 * محرك عمولة تلقائي — بند وحيد من BACKLOG.md § وحدة 3: "دفعة اتحصّلت → عمولة اتحسبت واتسجّلت"،
 * لخطط `OnCollection` بس (`RevenuePercent`/`CollectionBased`، الاتنين محسوبين بنفس الصيغة هنا:
 * نسبة % من المبلغ المحصَّل فعليًا في التخصيص ده). `GrossProfitPercent`/`Tiered` مش مدعومين هنا —
 * محتاجين `DealActual` مش مبني بعد (نفس القيد الموثّق في BACKLOG.md).
 *
 * ⚠️ مفيش ربط بين `CommissionPlan` وموظف/صفقة معيّنة في الـschema أصلًا — لو فيه أكتر من خطة
 * `OnCollection` مؤهّلة (أو صفر)، مفيش طريقة مضمونة نعرف بيها أنهي واحدة تتطبّق، فالمحرك بيتجاهل
 * الحالة دي عمدًا (بلا تخمين) ويسيب الإنشاء اليدوي زي ما هو — نفس مبدأ "ممنوع تلفيق" المتكرر في
 * المشروع. بالمثل، لو الصفقة/الفرصة بلا `ownerId`، مفيش موظف واضح يستحق العمولة، فمفيش إنشاء.
 *
 * الإنشاء دايمًا `status: "Accrued"` — نفس قاعدة الإنشاء اليدوي بالحرف، لسه محتاج اعتماد إداري
 * صريح (`approveCommissionEntryAction`) قبل أي سداد فعلي، فمفيش أثر مالي مباشر من الأتمتة دي.
 *
 * ⚠️ ارتداد الدفعة (`bouncePaymentAction`) مش بيرجع أي عمولة اتحسبت هنا لسه — خارج نطاق البند ده
 * (الارتداد أصلًا مرفوض طول ما فيه تخصيصات، راجع `deletePaymentAllocationAction` في arap-actions.ts
 * اللي بيشيل العمولة دي فعليًا لو اتلغى التخصيص اللي ولّدها وهي لسه Accrued).
 */
export async function accrueCommissionOnCollection(
  tx: ScopedTx,
  params: { orgId: string; dealId: string | null; allocatedAmount: number; currency: string; performedByUserId: string; paymentAllocationId: string }
): Promise<void> {
  const { orgId, dealId, allocatedAmount, currency, performedByUserId, paymentAllocationId } = params;
  if (!dealId) return;

  const deal = await tx.deal.findUnique({ where: { id: dealId }, include: { opportunity: { select: { ownerId: true } } } });
  const ownerId = deal?.opportunity.ownerId;
  if (!ownerId) return;

  const plans = await tx.commissionPlan.findMany({
    where: { orgId, triggerEvent: "OnCollection", basis: { in: ["RevenuePercent", "CollectionBased"] } },
  });
  if (plans.length !== 1) return; // صفر أو أكتر من خطة مؤهّلة — غموض حقيقي، مش تخمين.
  const plan = plans[0];
  if (!plan.ratePct || Number(plan.ratePct) <= 0) return;

  const amount = Math.round(allocatedAmount * (Number(plan.ratePct) / 100) * 100) / 100;
  if (amount <= 0) return;

  const entry = await tx.commissionEntry.create({
    data: { orgId, planId: plan.id, dealId, userId: ownerId, amount, currency, status: "Accrued", paymentAllocationId },
  });
  await logAudit(tx, {
    orgId,
    userId: performedByUserId,
    action: "commissionEntry.autoAccruedOnCollection",
    entityType: "CommissionEntry",
    entityId: entry.id,
    afterValue: { planId: plan.id, dealId, userId: ownerId, amount, currency, paymentAllocationId },
  });
}
