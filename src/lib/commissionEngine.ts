import { Prisma } from "@/generated/prisma/client";
import type { ScopedTx } from "@/lib/scoped-prisma";
import { logAudit } from "@/lib/audit";
import { commissionAutomationState, eligiblePlansForAutoAccrual } from "@/lib/commissionAutomation";

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
 * ⚠️ التجاهل ده **مابقاش صامت**: صفحة خطط العمولة بتعرض حالة الأتمتة دايمًا بنفس الدالة
 * المستخدمة هنا (`commissionAutomationState`). قبل كده كان المحاسب يخصّص دفعة، التخصيص
 * ينجح، والعمولة ما تتسجّلش بلا أي إشارة — راجع src/lib/commissionAutomation.ts.
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

  // ⚠️ الفلترة بتتعمل في TypeScript بـ`eligiblePlansForAutoAccrual` مش في الاستعلام،
  // عشان الشاشة اللي بتعرض حالة الأتمتة (/commission-plans) تستخدم **نفس الدالة** بالحرف.
  // لو الاتنين اتفرقوا، الشاشة هتقول «الأتمتة شغّالة» والمحرك مابيسجّلش (أو العكس) —
  // وده أسوأ من الصمت الأصلي لأنه بيدّي طمأنينة غلط.
  const allPlans = await tx.commissionPlan.findMany({ where: { orgId } });
  const state = commissionAutomationState(allPlans);
  if (state.status !== "Active") return;
  const plan = eligiblePlansForAutoAccrual(allPlans)[0];

  // النسبة جاية من `state` مش من `plan.ratePct` مباشرة — عشان الرقم اللي بيتحسب بيه
  // المبلغ يبقى **نفس** الرقم اللي الشاشة بتعرضه للمستخدم، بلا أي احتمال اختلاف.
  const amount = new Prisma.Decimal(allocatedAmount).mul(state.ratePct).div(100).toDecimalPlaces(2);
  if (amount.lte(0)) return;

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
