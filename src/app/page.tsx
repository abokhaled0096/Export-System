import Link from "next/link";
import { getScopedPrisma } from "@/lib/scoped-prisma";
import { getCurrentOrgId } from "@/lib/org";

// بيانات حية لكل طلب — منع الـPrerendering الثابت وقت البناء (راجع build output).
export const dynamic = "force-dynamic";

function Stat({ label, value, href }: { label: string; value: number; href: string }) {
  return (
    <Link
      href={href}
      className="flex flex-col gap-1 rounded-xl border border-neutral-200 bg-white px-5 py-4 hover:border-emerald-300 hover:shadow-sm"
    >
      <span className="text-3xl font-semibold text-neutral-900">{value}</span>
      <span className="text-sm text-neutral-500">{label}</span>
    </Link>
  );
}

export default async function Home() {
  const orgId = await getCurrentOrgId();
  const prisma = await getScopedPrisma();
  // ⚠️ مش Promise.all — راجع BACKLOG.md (P2028: كل استعلام من getScopedPrisma() بيفتح
  // transaction لوحده، والتنفيذ بالتوازي بيتزاحم على اتصال الـpool).
  const productCount = await prisma.product.count({ where: { orgId, deletedAt: null } });
  const marketCount = await prisma.market.count({ where: { orgId, deletedAt: null } });
  const analysisCount = await prisma.productMarketAnalysis.count({ where: { orgId } });
  const companyCount = await prisma.company.count({ where: { orgId, deletedAt: null } });
  const opportunityCount = await prisma.opportunity.count({ where: { orgId, deletedAt: null } });

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="text-2xl font-semibold text-neutral-900">لوحة القيادة</h1>
      <p className="mt-1 text-sm text-neutral-500">
        نطاق P1 — منتج وسوق وتحليل. راجع <code className="text-xs">docs/SCOPE-P1.md</code> لباقي المراحل.
      </p>

      <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Stat label="منتج مسجّل" value={productCount} href="/products" />
        <Stat label="سوق مسجّل" value={marketCount} href="/markets" />
        <Stat label="تحليل منتج × سوق" value={analysisCount} href="/analysis" />
        <Stat label="شركة مسجّلة" value={companyCount} href="/companies" />
        <Stat label="فرصة مسجّلة" value={opportunityCount} href="/opportunities" />
      </div>
    </main>
  );
}
