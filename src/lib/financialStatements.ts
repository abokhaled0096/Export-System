import { Prisma } from "@/generated/prisma/client";
import type { getScopedPrisma } from "@/lib/scoped-prisma";

/** نفس نوع العميل اللي `getScopedPrisma()` بيرجّعه — القوائم دي بتتقرا من داخل سياق RLS. */
type ScopedPrismaClient = Awaited<ReturnType<typeof getScopedPrisma>>;

/**
 * قائمة الدخل والميزانية العمومية — مبنيين من `JournalLine` مباشرة، مش من جداول موازية.
 *
 * قرارات محاسبية مقصودة:
 *
 * 1. **القيم الوظيفية (`functionalDebit`/`functionalCredit`) هي المستخدمة، مش `debit`/`credit`.**
 *    القائمة بتجمع حسابات بعملات مختلفة في رقم واحد — جمع 1000 EUR على 1000 EGP كأنهم نفس
 *    الشيء رقم بلا معنى. الأعمدة الوظيفية مصانة بـTrigger ومتساوية مع الأصلية أصلًا لو المنظمة
 *    مافيهاش عملة وظيفية. (نفس العيب اللي اتصلح في `computeVatBalance` — راجع STATUS.md.)
 *
 * 2. **المسودات مستبعدة، والمعكوس وعكسه الاتنين داخلين** — نفس قاعدة ميزان المراجعة بالحرف:
 *    صافي أثر القيد المعكوس صفر فعليًا، فاستبعاد الأصل بس كان هيشوّه الأرقام.
 *
 * 3. **ربح الفترة الجاري بيدخل حقوق الملكية في الميزانية.** مفيش قيد إقفال سنوي في المنظومة
 *    لسه، فمن غير السطر ده الميزانية مش هتتزن أبدًا (الأصول هتزيد بمقدار الربح بلا ما يقابلها
 *    حاجة). السطر مسمّى "أرباح الفترة (غير مقفولة)" عشان يبان إنه محسوب مش مُرحَّل.
 */

/** المسودات مستبعدة — مش قيود فعلية لسه. */
const POSTED: Prisma.JournalEntryWhereInput = { status: { in: ["Posted", "Reversed"] } };

export type StatementLine = {
  accountId: string;
  accountCode: string;
  nameAr: string;
  /** موجب = الاتجاه الطبيعي للحساب (إيراد دائن، مصروف/أصل مدين). */
  amount: Prisma.Decimal;
};

export type IncomeStatement = {
  revenue: StatementLine[];
  cogs: StatementLine[];
  expenses: StatementLine[];
  totalRevenue: Prisma.Decimal;
  totalCogs: Prisma.Decimal;
  grossProfit: Prisma.Decimal;
  totalExpenses: Prisma.Decimal;
  netProfit: Prisma.Decimal;
  /** نسبة مجمل الربح للإيراد — null لو مفيش إيراد (قسمة على صفر). */
  grossMarginPct: Prisma.Decimal | null;
  netMarginPct: Prisma.Decimal | null;
};

export type BalanceSheet = {
  assets: StatementLine[];
  liabilities: StatementLine[];
  equity: StatementLine[];
  totalAssets: Prisma.Decimal;
  totalLiabilities: Prisma.Decimal;
  /** حقوق الملكية المُرحَّلة بس، من غير ربح الفترة. */
  totalEquityPosted: Prisma.Decimal;
  /** أرباح غير مقفولة = إيراد − تكلفة مبيعات − مصروفات، من أول النشاط لحد التاريخ ده. */
  retainedEarnings: Prisma.Decimal;
  totalEquity: Prisma.Decimal;
  totalLiabilitiesAndEquity: Prisma.Decimal;
  /** الفرق لازم يكون صفر. لو مش صفر، فيه قيد غير متوازن أو حساب بلا نوع صحيح. */
  difference: Prisma.Decimal;
  isBalanced: boolean;
};

const ZERO = new Prisma.Decimal(0);
const sum = (lines: StatementLine[]) => lines.reduce((t, l) => t.add(l.amount), ZERO);

type Bucket = { type: string; lines: StatementLine[] };

/**
 * بيجمع أرصدة الحسابات بالقيم الوظيفية ويقسّمها بنوع الحساب.
 * `where` بيتبني من الاستدعاء (فترة، أو مدى تواريخ، أو "لحد تاريخ").
 */
async function balancesByType(
  prisma: ScopedPrismaClient,
  orgId: string,
  entryWhere: Prisma.JournalEntryWhereInput
): Promise<Map<string, Bucket>> {
  const grouped = await prisma.journalLine.groupBy({
    by: ["accountId"],
    where: { orgId, journalEntry: { ...POSTED, ...entryWhere } },
    _sum: { functionalDebit: true, functionalCredit: true },
  });

  if (grouped.length === 0) return new Map();

  // ⚠️ مش Promise.all — راجع BACKLOG.md (P2028).
  const accounts = await prisma.chartOfAccount.findMany({
    where: { orgId, id: { in: grouped.map((g) => g.accountId) } },
    select: { id: true, accountCode: true, nameAr: true, accountType: true, normalBalance: true },
  });
  const accountById = new Map(accounts.map((a) => [a.id, a]));

  const buckets = new Map<string, Bucket>();
  for (const g of grouped) {
    const account = accountById.get(g.accountId);
    if (!account) continue; // حساب اتمسح — ما ينفعش يتحط في قائمة بلا نوع

    const debit = new Prisma.Decimal(g._sum?.functionalDebit ?? 0);
    const credit = new Prisma.Decimal(g._sum?.functionalCredit ?? 0);
    // الرصيد في اتجاه الحساب الطبيعي: حساب مدين (أصل/مصروف) = مدين − دائن، والعكس.
    const amount = account.normalBalance === "Debit" ? debit.sub(credit) : credit.sub(debit);

    // حساب برصيد صفر مالوش لازمة في قائمة مالية — بيزحم الورقة بلا معلومة.
    if (amount.isZero()) continue;

    const bucket = buckets.get(account.accountType) ?? { type: account.accountType, lines: [] };
    bucket.lines.push({ accountId: account.id, accountCode: account.accountCode, nameAr: account.nameAr, amount });
    buckets.set(account.accountType, bucket);
  }

  for (const bucket of buckets.values()) {
    bucket.lines.sort((a, b) => a.accountCode.localeCompare(b.accountCode));
  }
  return buckets;
}

const linesOf = (buckets: Map<string, Bucket>, type: string) => buckets.get(type)?.lines ?? [];

/** نسبة مئوية بمنزلتين، أو null لو المقام صفر. */
function pct(numerator: Prisma.Decimal, denominator: Prisma.Decimal): Prisma.Decimal | null {
  if (denominator.isZero()) return null;
  return numerator.div(denominator).mul(100).toDecimalPlaces(2);
}

/** قائمة الدخل لمدى تواريخ (أو لفترة محاسبية لو اتبعت `periodId`). */
export async function computeIncomeStatement(
  prisma: ScopedPrismaClient,
  orgId: string,
  range: { periodId?: string; from?: Date; to?: Date }
): Promise<IncomeStatement> {
  const entryWhere: Prisma.JournalEntryWhereInput = range.periodId
    ? { periodId: range.periodId }
    : { entryDate: { ...(range.from ? { gte: range.from } : {}), ...(range.to ? { lte: range.to } : {}) } };

  const buckets = await balancesByType(prisma, orgId, entryWhere);

  const revenue = linesOf(buckets, "Revenue");
  const cogs = linesOf(buckets, "COGS");
  const expenses = linesOf(buckets, "Expense");

  const totalRevenue = sum(revenue);
  const totalCogs = sum(cogs);
  const grossProfit = totalRevenue.sub(totalCogs);
  const totalExpenses = sum(expenses);
  const netProfit = grossProfit.sub(totalExpenses);

  return {
    revenue,
    cogs,
    expenses,
    totalRevenue,
    totalCogs,
    grossProfit,
    totalExpenses,
    netProfit,
    grossMarginPct: pct(grossProfit, totalRevenue),
    netMarginPct: pct(netProfit, totalRevenue),
  };
}

/**
 * الميزانية العمومية كما في تاريخ معيّن — أرصدة تراكمية من أول النشاط لحد `asOf` (مش لفترة
 * واحدة، ده الفرق الجوهري عن قائمة الدخل).
 */
export async function computeBalanceSheet(prisma: ScopedPrismaClient, orgId: string, asOf: Date): Promise<BalanceSheet> {
  const buckets = await balancesByType(prisma, orgId, { entryDate: { lte: asOf } });

  const assets = linesOf(buckets, "Asset");
  const liabilities = linesOf(buckets, "Liability");
  const equity = linesOf(buckets, "Equity");

  const totalAssets = sum(assets);
  const totalLiabilities = sum(liabilities);
  const totalEquityPosted = sum(equity);

  // أرباح غير مقفولة — راجع القرار (3) فوق.
  const retainedEarnings = sum(linesOf(buckets, "Revenue")).sub(sum(linesOf(buckets, "COGS"))).sub(sum(linesOf(buckets, "Expense")));

  const totalEquity = totalEquityPosted.add(retainedEarnings);
  const totalLiabilitiesAndEquity = totalLiabilities.add(totalEquity);
  const difference = totalAssets.sub(totalLiabilitiesAndEquity);

  return {
    assets,
    liabilities,
    equity,
    totalAssets,
    totalLiabilities,
    totalEquityPosted,
    retainedEarnings,
    totalEquity,
    totalLiabilitiesAndEquity,
    difference,
    isBalanced: difference.isZero(),
  };
}
