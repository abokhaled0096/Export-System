import Link from "next/link";
import { notFound } from "next/navigation";
import { getScopedPrisma } from "@/lib/scoped-prisma";
import { requireCurrentUser } from "@/lib/session";
import { getPermissionScope } from "@/lib/permissions";
import QuoteForm from "./QuoteForm";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function NewQuotePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ scenarioId?: string }>;
}) {
  const { id } = await params;
  const { scenarioId } = await searchParams;
  const user = await requireCurrentUser();
  const orgId = user.orgId;
  const prisma = await getScopedPrisma();
  // ⚠️ نفس القيد في /deals/[id] و/deals/[id]/scenarios/[scenarioId] — أهم مكان فعليًا، لأن ده
  // بالظبط الفورم اللي SalesRep بيدخل عليه عادةً عشان ينشئ عرض سعر (عنده Quote.Create أصلًا).
  // بلا القيد ده، إخفاء walkAwayPrice في الصفحات التانية كان هيبقى بلا معنى.
  const dealViewScope = await getPermissionScope(user.roleId, "Deal", "View");
  const canSeeInternalPricing = dealViewScope === "Team" || dealViewScope === "Org";

  const deal = await prisma.deal.findFirst({ where: { id, orgId } });
  if (!deal) notFound();

  const scenario = scenarioId
    ? await prisma.dealScenario.findFirst({ where: { id: scenarioId, orgId, dealId: id, isLocked: true } })
    : null;

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <Button nativeButton={false} variant="link" className="px-0" render={<Link href={`/deals/${id}`}>← رجوع للصفقة</Link>} />
      <h1 className="mt-3 text-2xl font-semibold text-foreground">عرض سعر جديد</h1>

      {!scenario ? (
        <p className="mt-3 w-fit rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
          محتاج سيناريو مقفول عشان تنشئ عرض سعر منه.
        </p>
      ) : (
        <div className="mt-8">
          <QuoteForm
            scenarioId={scenario.id}
            currency={scenario.currency}
            walkAwayPrice={canSeeInternalPricing ? scenario.walkAwayPrice.toString() : null}
          />
        </div>
      )}
    </main>
  );
}
