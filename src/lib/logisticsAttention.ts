import type { getScopedPrisma } from "@/lib/scoped-prisma";

type ScopedPrismaClient = Awaited<ReturnType<typeof getScopedPrisma>>;

/**
 * عدد الشحنات "محتاجة انتباه".
 *
 * ⚠️ **تعريف واحد مشترك** بين شارة التنقّل ولوحة القيادة عن قصد. قبل كده كان كل واحد
 * بيحسبها بطريقته: الشارة كانت بتجمع الاستثناءات + التجاوزات الحرارية، واللوحة كانت
 * بتعدّ الاستثناءات بس. النتيجة إن المستخدم يشوف شارة حمراء فيها 1 وفي نفس اللحظة
 * اللوحة بتقول «مفيش حاجة مستنّية قرارك» — تناقض بيضيّع الثقة في اللوحة كلها.
 * (اتكشف بتجربة تسجيل تجاوز حراري، 30 سبتمبر.)
 *
 * التعريف: شحنة عندها **استثناء لوجستي مفتوح بخطورة عالية/حرجة**، أو **تجاوز حراري
 * مسجَّل**. العدّ بالشحنة مش بالحدث — شحنة عندها 3 مشاكل لسه شحنة واحدة محتاجة انتباه.
 */
export async function countShipmentsNeedingAttention(prisma: ScopedPrismaClient, orgId: string): Promise<number> {
  // ⚠️ مش Promise.all — راجع BACKLOG.md (P2028).
  const criticalExceptions = await prisma.logisticsException.findMany({
    where: { orgId, status: { in: ["Open", "InProgress"] }, severity: { in: ["High", "Critical"] } },
    select: { shipmentId: true },
    distinct: ["shipmentId"],
  });
  const excursions = await prisma.temperatureLog.findMany({
    where: { orgId, isExcursion: true },
    select: { shipmentId: true },
    distinct: ["shipmentId"],
  });
  return new Set([...criticalExceptions.map((e) => e.shipmentId), ...excursions.map((e) => e.shipmentId)]).size;
}
