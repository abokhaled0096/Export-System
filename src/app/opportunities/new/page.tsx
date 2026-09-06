import Link from "next/link";
import { getScopedPrisma } from "@/lib/scoped-prisma";
import { getCurrentOrgId } from "@/lib/org";
import { Button } from "@/components/ui/button";
import OpportunityForm from "./OpportunityForm";

export const dynamic = "force-dynamic";

export default async function NewOpportunityPage({
  searchParams,
}: {
  searchParams: Promise<{ companyId?: string }>;
}) {
  const { companyId } = await searchParams;
  const orgId = await getCurrentOrgId();
  const prisma = await getScopedPrisma();
  // ⚠️ مش Promise.all — راجع BACKLOG.md (P2028).
  const companies = await prisma.company.findMany({ where: { orgId, deletedAt: null }, orderBy: { legalName: "asc" } });
  const contacts = await prisma.contact.findMany({
    where: { orgId, deletedAt: null },
    include: { company: true },
    orderBy: { name: "asc" },
  });
  const products = await prisma.product.findMany({ where: { orgId, deletedAt: null }, orderBy: { nameAr: "asc" } });
  const markets = await prisma.market.findMany({ where: { orgId, deletedAt: null }, orderBy: { countryNameAr: "asc" } });

  const backHref = companyId ? `/companies/${companyId}` : "/opportunities";

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <Button nativeButton={false} variant="link" className="h-auto p-0" render={<Link href={backHref}>← رجوع</Link>} />
      <h1 className="mt-3 text-2xl font-semibold text-foreground">فرصة جديدة</h1>
      {(companies.length === 0 || products.length === 0 || markets.length === 0) && (
        <p className="mt-3 w-fit rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
          محتاج شركة ومنتج وسوق مسجّلين الأول.
        </p>
      )}
      <div className="mt-8">
        <OpportunityForm
          companies={companies.map((c) => ({ id: c.id, label: c.legalName }))}
          contacts={contacts.map((c) => ({
            id: c.id,
            label: `${c.name} (${c.company.legalName})`,
            companyId: c.companyId,
          }))}
          products={products.map((p) => ({ id: p.id, label: p.nameAr }))}
          markets={markets.map((m) => ({ id: m.id, label: m.countryNameAr }))}
          defaultCompanyId={companyId}
        />
      </div>
    </main>
  );
}
