import Link from "next/link";
import { notFound } from "next/navigation";
import { getScopedPrisma } from "@/lib/scoped-prisma";
import { requireCurrentUser } from "@/lib/session";
import { getBatchView } from "@/app/analysis/batchActions";
import { Button } from "@/components/ui/button";
import BatchProgress from "./BatchProgress";

export const dynamic = "force-dynamic";

export default async function BatchProgressPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireCurrentUser();

  let view;
  try {
    view = await getBatchView(id);
  } catch {
    notFound();
  }

  const prisma = await getScopedPrisma();
  // ⚠️ مش Promise.all — راجع BACKLOG.md (P2028).
  const products = await prisma.product.findMany({ where: { orgId: user.orgId }, select: { id: true, nameAr: true } });
  const markets = await prisma.market.findMany({ where: { orgId: user.orgId }, select: { id: true, countryNameAr: true } });
  const productLabels = Object.fromEntries(products.map((p) => [p.id, p.nameAr]));
  const marketLabels = Object.fromEntries(markets.map((m) => [m.id, m.countryNameAr]));

  const backHref = view.kind === "MarketAnalysis" ? "/analysis" : "/competitors";
  const title = view.kind === "MarketAnalysis" ? "تحليل السوق الشامل" : "بحث المنافسين الشامل";

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <Button nativeButton={false} variant="link" className="h-auto p-0" render={<Link href={backHref}>← رجوع</Link>} />
      <h1 className="mt-3 text-2xl font-semibold text-foreground">{title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {view.totalPairs} تركيبة (منتج × سوق) — الصفحة بتتحدّث تلقائي لحد ما الدفعة تخلص.
      </p>

      <div className="mt-8">
        <BatchProgress batchId={id} initialView={view} productLabels={productLabels} marketLabels={marketLabels} resultBaseHref={view.kind === "MarketAnalysis" ? "/analysis" : "/competitors"} />
      </div>
    </main>
  );
}
