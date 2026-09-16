import { Prisma } from "@/generated/prisma/client";
import type { ScopedTx } from "@/lib/scoped-prisma";

export type SalesTargetForComputation = {
  orgId: string;
  userId: string | null;
  teamId: string | null;
  targetType: "Revenue" | "Volume" | "DealsCount";
  currency: string | null;
  periodStart: Date | null;
  periodEnd: Date | null;
};

export type SalesTargetActualResult = {
  /** null = مش قابل للحساب (مدى فترة ناقص، أو Revenue بلا عملة محدَّدة) — مش صفر. */
  value: Prisma.Decimal | null;
  matchedOrderCount: number;
  /** أوامر بيع حقيقية في نفس المدى/النطاق، بس بعملة مختلفة عن عملة الهدف — اتستبعدت من
   * Revenue عمدًا (جمع مبالغ بعملات مختلفة بلا تحويل حقيقي بيدّي رقم غلط، نفس مبدأ محرك فروق
   * العملة). صفر لـVolume/DealsCount (العملة مش مؤثرة فيهم). */
  excludedByCurrencyCount: number;
};

/**
 * بيحسب "القيمة الفعلية" الحقيقية لهدف مبيعات من أوامر بيع (SalesOrder) حقيقية في نفس المدى
 * الزمني ونفس نطاق الملكية (مستخدم/فريق) — بند من BACKLOG.md § وحدة 3. مقصود يتنادى من فعل
 * صريح ("احسب/حدّث القيمة الفعلية")، مش تلقائي وقت العرض، عشان يفضل الرقم المسجَّل ثابت لحد ما
 * حد يطلب إعادة الحساب — لكنه دايمًا قابل لإعادة الحساب بأمان (بلا أي أثر محاسبي/قيد، مجرد
 * تحديث عمود ملخّص).
 *
 * أوامر البيع المحتسبة: أي حالة غير Draft/Cancelled (يعني اتأكدت فعليًا كمبيعة حقيقية) في مدى
 * `periodStart..periodEnd` — مفيش `closedAt` منفصل في الـschema، فـ`createdAt` هو أقرب تقريب
 * حقيقي متاح لـ"وقت تسجيل الأمر"، موثَّق هنا كقرار واعٍ.
 */
export async function computeSalesTargetActual(tx: ScopedTx, target: SalesTargetForComputation): Promise<SalesTargetActualResult> {
  if (!target.periodStart || !target.periodEnd) {
    return { value: null, matchedOrderCount: 0, excludedByCurrencyCount: 0 };
  }

  let ownerIds: string[] | undefined;
  if (target.userId) {
    ownerIds = [target.userId];
  } else if (target.teamId) {
    const teamUsers = await tx.user.findMany({ where: { orgId: target.orgId, teamId: target.teamId }, select: { id: true } });
    ownerIds = teamUsers.map((u) => u.id);
    if (ownerIds.length === 0) return { value: new Prisma.Decimal(0), matchedOrderCount: 0, excludedByCurrencyCount: 0 };
  }

  const orders = await tx.salesOrder.findMany({
    where: {
      orgId: target.orgId,
      status: { notIn: ["Draft", "Cancelled"] },
      createdAt: { gte: target.periodStart, lte: target.periodEnd },
      ...(ownerIds ? { deal: { opportunity: { ownerId: { in: ownerIds } } } } : {}),
    },
    select: { id: true, currency: true, totalValue: true, lines: { select: { quantity: true } } },
  });

  if (target.targetType === "DealsCount") {
    return { value: new Prisma.Decimal(orders.length), matchedOrderCount: orders.length, excludedByCurrencyCount: 0 };
  }

  if (target.targetType === "Volume") {
    const total = orders.reduce((sum, o) => sum.add(o.lines.reduce((s, l) => s.add(l.quantity), new Prisma.Decimal(0))), new Prisma.Decimal(0));
    return { value: total, matchedOrderCount: orders.length, excludedByCurrencyCount: 0 };
  }

  // Revenue — لازم عملة محدَّدة للهدف نفسه، وإلا جمع totalValue بعملات مختلفة هيدّي رقم غلط
  // (نفس فخ "توازن وهمي" اللي enforce_journal_entry_balanced اتصمم أصلًا عشان يمنعه).
  if (!target.currency) {
    return { value: null, matchedOrderCount: 0, excludedByCurrencyCount: 0 };
  }
  const matching = orders.filter((o) => o.currency === target.currency);
  const total = matching.reduce((sum, o) => sum.add(o.totalValue), new Prisma.Decimal(0));
  return { value: total, matchedOrderCount: matching.length, excludedByCurrencyCount: orders.length - matching.length };
}
