import Link from "next/link";
import { getScopedPrisma } from "@/lib/scoped-prisma";
import { requireCurrentUser } from "@/lib/session";
import { getPermissionScope, ownerScopeWhere } from "@/lib/permissions";
import DealForm from "./DealForm";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function NewDealPage({
  searchParams,
}: {
  searchParams: Promise<{ opportunityId?: string }>;
}) {
  const { opportunityId } = await searchParams;
  const user = await requireCurrentUser();
  const orgId = user.orgId;
  const prisma = await getScopedPrisma();
  // ⚠️ الفورم كان بيسرّب اسم شركة/منتج كل فرص المنظمة في القائمة المنسدلة بغض النظر عن ملكية
  // المستخدم — createDeal نفسها بترفض إنشاء الصفقة لو الفرصة مش بتاعته (assertOwnScope)، لكن
  // القائمة كانت بتعرض بيانات فرص تانية قبل الإرسال أصلًا (اتكشف في إعادة مراجعة وحدة 2، 7 سبتمبر).
  const scope = await getPermissionScope(user.roleId, "Opportunity", "View");
  const ownerFilter = await ownerScopeWhere(scope, user);
  const opportunities = await prisma.opportunity.findMany({
    where: { orgId, deletedAt: null, ...ownerFilter },
    include: { company: true, product: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <Button nativeButton={false} variant="link" className="px-0" render={<Link href="/deals">← رجوع</Link>} />
      <h1 className="mt-3 text-2xl font-semibold text-foreground">صفقة جديدة</h1>
      {opportunities.length === 0 && (
        <p className="mt-3 w-fit rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
          محتاج فرصة مسجّلة الأول.
        </p>
      )}
      <div className="mt-8">
        <DealForm
          opportunities={opportunities.map((o) => ({
            id: o.id,
            label: `${o.company.legalName} — ${o.product.nameAr}`,
          }))}
          defaultOpportunityId={opportunityId}
        />
      </div>
    </main>
  );
}
