import Link from "next/link";
import { notFound } from "next/navigation";
import { getScopedPrisma } from "@/lib/scoped-prisma";
import { requireCurrentUser } from "@/lib/session";
import { getPermissionScope, scopedOwnerIdFilter } from "@/lib/permissions";
import ScenarioForm from "./ScenarioForm";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function NewScenarioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireCurrentUser();
  const orgId = user.orgId;
  const prisma = await getScopedPrisma();
  // ⚠️ نفس فجوة IDOR في /deals/[id] — اتكشف هنا كمان في إعادة مراجعة وحدة 2 (7 سبتمبر).
  const dealViewScope = await getPermissionScope(user.roleId, "Deal", "View");
  const scopedOwnerId = await scopedOwnerIdFilter(dealViewScope, user);
  const ownerWhere = scopedOwnerId !== undefined ? { opportunity: { ownerId: scopedOwnerId } } : {};
  const deal = await prisma.deal.findFirst({ where: { id, orgId, ...ownerWhere } });
  if (!deal) notFound();

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <Button nativeButton={false} variant="link" className="px-0" render={<Link href={`/deals/${deal.id}`}>← رجوع للصفقة</Link>} />
      <h1 className="mt-3 text-2xl font-semibold text-foreground">سيناريو تسعير جديد</h1>
      <div className="mt-8">
        <ScenarioForm dealId={deal.id} />
      </div>
    </main>
  );
}
