import Link from "next/link";
import { getScopedPrisma } from "@/lib/scoped-prisma";
import { getCurrentOrgId } from "@/lib/org";
import { Button } from "@/components/ui/button";
import AiCompetitorForm from "./AiCompetitorForm";

export const dynamic = "force-dynamic";

export default async function NewAiCompetitorsPage() {
  const orgId = await getCurrentOrgId();
  const prisma = await getScopedPrisma();
  const products = await prisma.product.findMany({ where: { orgId, deletedAt: null }, orderBy: { nameAr: "asc" } });
  const markets = await prisma.market.findMany({ where: { orgId, deletedAt: null }, orderBy: { countryNameAr: "asc" } });

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <Button nativeButton={false} variant="link" className="h-auto p-0" render={<Link href="/competitors">← رجوع لقائمة المنافسين</Link>} />
      <h1 className="mt-3 text-2xl font-semibold text-foreground">بحث عن منافسين بالذكاء الاصطناعي</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        هيبحث فعليًا في الإنترنت عن الدول المصدّرة المنافسة الحقيقية لنفس المنتج والسوق، بمواسمها وأسعارها التقريبية لو متاحة — مش قائمة نظرية.
      </p>
      <div className="mt-8">
        <AiCompetitorForm
          products={products.map((p) => ({ id: p.id, label: `${p.nameAr} (${p.nameEn})` }))}
          markets={markets.map((m) => ({ id: m.id, label: m.countryNameAr }))}
        />
      </div>
    </main>
  );
}
