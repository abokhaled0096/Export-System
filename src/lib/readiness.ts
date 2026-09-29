import type { getScopedPrisma } from "@/lib/scoped-prisma";
import { GL_ACCOUNTS } from "@/lib/glAccounts";

type ScopedPrismaClient = Awaited<ReturnType<typeof getScopedPrisma>>;

/**
 * فحص جاهزية التشغيل.
 *
 * المشكلة اللي بيحلّها: السيستم كان بيسيب المستخدم يوصل لآخر خطوة (يعمل فاتورة، يضيف
 * بنودها، يدوس «إصدار») وبعدين يرميله خطأ إن مفيش فترة محاسبية مفتوحة. الأخطاء دي
 * صحيحة ومفروضة على مستوى القاعدة عن قصد، لكن **وقت اكتشافها متأخر جدًا**. الفحص ده
 * بيقول للمستخدم من لوحة القيادة إيه الناقص قبل ما يبدأ.
 *
 * كل بند هنا **مقيس من القاعدة فعلًا** مش قائمة ثابتة بيدوسها المستخدم — يعني مستحيل
 * تقول «تمام» والواقع غير كده، وبتتحدّث لوحدها أول ما الناقص يتظبط.
 */

export type ReadinessItem = {
  id: string;
  label: string;
  /** إيه اللي هيتعطّل من غيره — بلغة المستخدم مش بلغة النظام. */
  blocks: string;
  done: boolean;
  href: string;
  actionLabel: string;
  /** blocking = بيمنع أول دورة بيع كاملة. optional = بيحسّن بس مش بيمنع. */
  severity: "blocking" | "optional";
};

export type Readiness = {
  items: ReadinessItem[];
  blockingRemaining: number;
  isReady: boolean;
};

export async function getReadiness(prisma: ScopedPrismaClient, orgId: string): Promise<Readiness> {
  const now = new Date();

  // ⚠️ مش Promise.all — راجع BACKLOG.md (P2028).
  // الفترة لازم تكون *مفتوحة وبتغطي النهاردة* — مش مجرد "فيه فترة". ده بالظبط الشرط اللي
  // findOpenPeriodFor بيفحصه وقت الترحيل، فالفحصين لازم يبقوا متطابقين وإلا اللوحة تكدب.
  const openPeriod = await prisma.accountingPeriod.count({
    where: { orgId, status: "Open", startDate: { lte: now }, endDate: { gte: now } },
  });

  // الحسابات الأساسية اللي أي فاتورة/دفعة بتترحّل عليها. ناقص واحد منهم = الترحيل بيفشل.
  const coreCodes = [GL_ACCOUNTS.CASH, GL_ACCOUNTS.AR, GL_ACCOUNTS.AP, GL_ACCOUNTS.REVENUE, GL_ACCOUNTS.COGS];
  const coreAccounts = await prisma.chartOfAccount.count({ where: { orgId, accountCode: { in: coreCodes } } });

  const bankAccounts = await prisma.bankAccount.count({ where: { orgId } });
  const products = await prisma.product.count({ where: { orgId, deletedAt: null } });
  const customers = await prisma.company.count({ where: { orgId, deletedAt: null } });
  const users = await prisma.user.count({ where: { orgId, isActive: true } });

  const items: ReadinessItem[] = [
    {
      id: "chart-of-accounts",
      label: "شجرة الحسابات",
      blocks: "من غيرها أي فاتورة أو دفعة مش هتترحّل محاسبيًا",
      done: coreAccounts >= coreCodes.length,
      href: "/accounting/chart-of-accounts",
      actionLabel: "راجع شجرة الحسابات",
      severity: "blocking",
    },
    {
      id: "accounting-period",
      label: "فترة محاسبية مفتوحة تغطي تاريخ النهاردة",
      blocks: "من غيرها إصدار أي فاتورة هيترفض",
      done: openPeriod > 0,
      href: "/accounting/periods",
      actionLabel: "افتح فترة",
      severity: "blocking",
    },
    {
      id: "bank-account",
      label: "حساب بنكي واحد على الأقل",
      blocks: "من غيره مفيش تحصيل ولا سداد ولا تدفّق نقدي",
      done: bankAccounts > 0,
      href: "/accounting/bank-accounts",
      actionLabel: "ضيف حساب بنكي",
      severity: "blocking",
    },
    {
      id: "products",
      label: "منتج واحد على الأقل",
      blocks: "المنتجات هي أساس التسعير وبنود الفاتورة",
      done: products > 0,
      href: "/products",
      actionLabel: "ضيف منتج",
      severity: "blocking",
    },
    {
      id: "customers",
      label: "عميل واحد على الأقل",
      blocks: "الفاتورة لازم تتوجّه لعميل مسجَّل",
      done: customers > 0,
      href: "/companies",
      actionLabel: "ضيف عميل",
      severity: "blocking",
    },
    {
      id: "users",
      label: "مستخدمو الشركة وصلاحياتهم",
      blocks: "فصل المهام مابيشتغلش بحساب واحد",
      done: users > 1,
      href: "/admin/users",
      actionLabel: "ضيف مستخدمين",
      severity: "optional",
    },
  ];

  const blockingRemaining = items.filter((i) => i.severity === "blocking" && !i.done).length;
  return { items, blockingRemaining, isReady: blockingRemaining === 0 };
}
