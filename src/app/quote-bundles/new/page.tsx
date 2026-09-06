import Link from "next/link";
import { requireCurrentUser } from "@/lib/session";
import { requirePermission, getPermissionScope, scopedOwnerIdFilter } from "@/lib/permissions";
import { getScopedPrisma } from "@/lib/scoped-prisma";
import ListSearch from "@/components/ListSearch";
import NewBundleForm from "./NewBundleForm";

export const dynamic = "force-dynamic";

export default async function NewQuoteBundlePage({ searchParams }: { searchParams: Promise<{ customerId?: string; q?: string }> }) {
  const user = await requireCurrentUser();

  try {
    await requirePermission(user.roleId, "QuoteBundle", "Create");
  } catch {
    return (
      <main className="mx-auto max-w-3xl px-6 py-10">
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-6 text-center text-sm text-destructive">
          معندكش صلاحية الوصول للصفحة دي.
        </div>
      </main>
    );
  }

  const { customerId, q } = await searchParams;
  const prisma = await getScopedPrisma();

  if (!customerId) {
    const companies = await prisma.company.findMany({
      where: { orgId: user.orgId, deletedAt: null, ...(q ? { legalName: { contains: q, mode: "insensitive" } } : {}) },
      orderBy: { legalName: "asc" },
      take: 50,
    });

    return (
      <main className="mx-auto max-w-2xl px-6 py-10">
        <Link href="/quote-bundles" className="text-sm text-muted-foreground hover:underline">
          → كل الحزم
        </Link>
        <h1 className="mt-3 text-2xl font-semibold text-foreground">حزمة جديدة — اختار العميل الأول</h1>
        <div className="mt-4">
          <ListSearch basePath="/quote-bundles/new" q={q} placeholder="اسم الشركة..." />
        </div>
        <div className="mt-4 flex flex-col gap-1">
          {companies.length === 0 ? (
            <p className="text-sm text-muted-foreground">مفيش شركات مطابقة.</p>
          ) : (
            companies.map((c) => (
              <Link
                key={c.id}
                href={`/quote-bundles/new?customerId=${c.id}`}
                className="rounded-lg border border-border bg-card px-4 py-2.5 text-sm text-foreground hover:border-primary"
              >
                {c.legalName}
              </Link>
            ))
          )}
        </div>
      </main>
    );
  }

  const customer = await prisma.company.findFirst({ where: { id: customerId, orgId: user.orgId } });
  if (!customer) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-10">
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-6 text-center text-sm text-destructive">
          العميل ده مش موجود.
        </div>
      </main>
    );
  }

  // مراجعة وحدة 2 (6 سبتمبر): لازم تفلتر بنفس scope الملكية بتاعة QuoteBundle.Create — من غير
  // الفلتر ده، SalesRep (Own) كان يقدر يشوف ويضم عروض أسعار من صفقات مش بتاعته خالص لنفس العميل.
  const bundleScope = await getPermissionScope(user.roleId, "QuoteBundle", "Create");
  const scopedOwnerId = await scopedOwnerIdFilter(bundleScope, user);
  const dealOwnerFilter = scopedOwnerId !== undefined ? { opportunity: { ownerId: scopedOwnerId } } : {};

  const eligibleQuotes = await prisma.quote.findMany({
    where: { orgId: user.orgId, customerId, bundleId: null, status: { in: ["Draft", "PendingApproval", "Sent"] }, deal: dealOwnerFilter },
    orderBy: { createdAt: "desc" },
    include: { deal: { include: { product: true } } },
  });

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <Link href="/quote-bundles/new" className="text-sm text-muted-foreground hover:underline">
        → اختيار عميل تاني
      </Link>
      <h1 className="mt-3 text-2xl font-semibold text-foreground">حزمة جديدة — {customer.legalName}</h1>
      <p className="mt-1 text-sm text-muted-foreground">اختار عروض الأسعار المستقلة اللي تتضم في مستند واحد للعميل ده.</p>

      {eligibleQuotes.length === 0 ? (
        <div className="mt-10 rounded-xl border border-dashed border-border py-16 text-center text-muted-foreground">
          <p>مفيش عروض أسعار قابلة للتجميع للعميل ده (لازم تكون مسودة/بانتظار موافقة/مُرسَلة، ومش متضافة لحزمة تانية).</p>
        </div>
      ) : (
        <NewBundleForm customerId={customerId} quotes={eligibleQuotes} />
      )}
    </main>
  );
}
