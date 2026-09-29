import Link from "next/link";
import { notFound } from "next/navigation";
import { Prisma } from "@/generated/prisma/client";
import { requireCurrentUser } from "@/lib/session";
import { requirePermission, getPermissionScope, scopedOwnerIdFilter } from "@/lib/permissions";
import { getScopedPrisma } from "@/lib/scoped-prisma";
import RemoveQuoteButton from "./RemoveQuoteButton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

const statusLabel: Record<string, string> = {
  Draft: "مسودة",
  PendingApproval: "بانتظار الموافقة",
  Sent: "مُرسَل",
  Accepted: "مقبول",
  Rejected: "مرفوض",
  Expired: "منتهي الصلاحية",
  Superseded: "مُستبدَل",
};

export default async function QuoteBundleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireCurrentUser();

  try {
    await requirePermission(user.roleId, "QuoteBundle", "View");
  } catch {
    return (
      <main className="mx-auto max-w-3xl px-6 py-10">
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-6 text-center text-sm text-destructive">
          معندكش صلاحية الوصول للصفحة دي.
        </div>
      </main>
    );
  }

  const prisma = await getScopedPrisma();

  // نفس فلتر ملكية /quote-bundles (راجع الملحوظة هناك).
  const scope = await getPermissionScope(user.roleId, "QuoteBundle", "View");
  const scopedOwnerId = await scopedOwnerIdFilter(scope, user);
  const ownerFilter = scopedOwnerId !== undefined ? { quotes: { some: { deal: { opportunity: { ownerId: scopedOwnerId } } } } } : {};

  const bundle = await prisma.quoteBundle.findFirst({
    where: { id, orgId: user.orgId, ...ownerFilter },
    include: {
      customer: true,
      createdByUser: { select: { fullName: true } },
      quotes: { include: { deal: { include: { product: true } } }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!bundle) notFound();

  // مجموع لكل عملة على حدة — عروض في نفس الحزمة ممكن تكون بعملات مختلفة (مفروض عليها نفس
  // العميل بس، مش نفس العملة)، فجمع كل المبالغ في رقم واحد كان هيدّي إجمالي بلا معنى.
  const totalsByCurrency = new Map<string, Prisma.Decimal>();
  for (const q of bundle.quotes) {
    totalsByCurrency.set(q.currency, (totalsByCurrency.get(q.currency) ?? new Prisma.Decimal(0)).add(q.unitPrice));
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <Link href="/quote-bundles" className="text-sm text-muted-foreground hover:underline">
        → كل الحزم
      </Link>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">حزمة عروض — {bundle.customer.legalName}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            اتعملت بمعرفة {bundle.createdByUser.fullName} · {formatDate(bundle.createdAt)}
          </p>
        </div>
        <Button nativeButton={false} variant="outline" render={<a href={`/quote-bundles/${bundle.id}/pdf`}>تحميل PDF مجمَّع</a>} />
      </div>

      <div className="mt-6 overflow-x-auto rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>المنتج</TableHead>
              <TableHead>النسخة</TableHead>
              <TableHead>سعر الوحدة</TableHead>
              <TableHead>الحالة</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bundle.quotes.map((q) => (
              <TableRow key={q.id}>
                <TableCell>
                  <Link href={`/deals/${q.dealId}`} className="text-primary hover:underline">
                    {q.deal.product.nameAr}
                  </Link>
                </TableCell>
                <TableCell className="font-mono text-foreground/80">v{q.version}</TableCell>
                <TableCell className="font-mono text-foreground">
                  {q.unitPrice.toFixed(2)} {q.currency}
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">{statusLabel[q.status] ?? q.status}</Badge>
                </TableCell>
                <TableCell>
                  <RemoveQuoteButton quoteId={q.id} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <p className="mt-3 text-sm text-muted-foreground">
        الإجمالي لكل عملة:{" "}
        {[...totalsByCurrency.entries()].map(([currency, total], i) => (
          <span key={currency} className="font-mono font-medium text-foreground">
            {i > 0 && " · "}
            {total.toFixed(2)} {currency}
          </span>
        ))}
      </p>
      <p className="mt-2 text-xs text-muted-foreground">
        كل عرض سعر هنا لسه مستقل تمامًا بمحرك تسعيره الأصلي (Deal/DealScenario/walkAwayPrice) — الحزمة تجميع مستندي بصري بس للعميل.
      </p>
    </main>
  );
}
