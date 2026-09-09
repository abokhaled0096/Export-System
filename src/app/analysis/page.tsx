import Link from "next/link";
import { getScopedPrisma } from "@/lib/scoped-prisma";
import { startMarketAnalysisBatchAction } from "./batchActions";
import BulkAnalysisButton from "./BulkAnalysisButton";
import { getCurrentOrgId } from "@/lib/org";
import { requireCurrentUser } from "@/lib/session";
import { requirePermission } from "@/lib/permissions";
import { PAGE_SIZE, parsePage } from "@/lib/pagination";
import Pagination from "@/components/Pagination";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const dynamic = "force-dynamic";

const recLabel: Record<string, string> = {
  Start: "ابدأ",
  Study: "ادرس أكتر",
  Monitor: "راقب",
  Avoid: "تجنّب",
};

const recStyle: Record<string, string> = {
  Start: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  Study: "bg-sky-100 text-sky-700 hover:bg-sky-100",
  Monitor: "bg-amber-100 text-amber-700 hover:bg-amber-100",
  Avoid: "bg-rose-100 text-rose-700 hover:bg-rose-100",
};

export default async function AnalysisPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const user = await requireCurrentUser();
  try {
    await requirePermission(user.roleId, "Analysis", "View");
  } catch {
    return (
      <main className="mx-auto max-w-3xl px-6 py-10">
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-6 text-center text-sm text-destructive">
          معندكش صلاحية الوصول للصفحة دي.
        </div>
      </main>
    );
  }

  const orgId = await getCurrentOrgId();
  const prisma = await getScopedPrisma();
  const page = parsePage((await searchParams).page);
  // ⚠️ مش Promise.all — راجع نفس الملاحظة في products/page.tsx (P2028). ده كان موجود من قبل
  // بصيغة Promise.all لـ3 استعلامات وشغّال بالصدفة (حظ في توقيت الاتصالات)، لحد ما ضفنا
  // استعلام رابع (total) وكشف المشكلة فعليًا.
  const analyses = await prisma.productMarketAnalysis.findMany({
    where: { orgId },
    include: { product: true, market: true },
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });
  const total = await prisma.productMarketAnalysis.count({ where: { orgId } });
  const productCount = await prisma.product.count({ where: { orgId, deletedAt: null } });
  const marketCount = await prisma.market.count({ where: { orgId, deletedAt: null } });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const canCreate = productCount > 0 && marketCount > 0;

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">تحليل المنتج والسوق</h1>
          <p className="mt-1 text-sm text-muted-foreground">{total} تحليل مسجّل</p>
        </div>
        {canCreate ? (
          <div className="flex gap-2">
            <Button nativeButton={false} className="bg-violet-700 text-white hover:bg-violet-800" render={<Link href="/analysis/ai/new">🤖 حلّل بالذكاء الاصطناعي</Link>} />
            <Button nativeButton={false} render={<Link href="/analysis/new">+ تحليل يدوي</Link>} />
          </div>
        ) : (
          <span className="rounded-lg bg-muted px-4 py-2 text-sm text-muted-foreground">
            محتاج منتج وسوق الأول
          </span>
        )}
      </div>

      {canCreate && (
        <div className="mt-4">
          <BulkAnalysisButton
            action={startMarketAnalysisBatchAction}
            label="📊 حلّل كل المنتجات × كل الأسواق"
            description="هيحلّل كل تركيبة منتج/سوق نشطة دفعة واحدة (حد أقصى 50 تركيبة) — ممكن ياخد لغاية 20-25 دقيقة، وشريط تقدّم حي هيظهرلك أول بأول."
            colorClass="bg-indigo-700 text-white hover:bg-indigo-800"
          />
        </div>
      )}

      {!canCreate && (
        <p className="mt-4 w-fit rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
          سجّل <Link href="/products/new" className="underline">منتج</Link> و
          <Link href="/markets/new" className="underline">سوق</Link> الأول عشان تقدر تعمل تحليل.
        </p>
      )}

      {analyses.length === 0 ? (
        <div className="mt-10 rounded-xl border border-dashed border-border py-16 text-center text-muted-foreground">
          لسه مفيش تحليلات مسجّلة.
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>المنتج</TableHead>
                <TableHead>السوق</TableHead>
                <TableHead>السنة</TableHead>
                <TableHead>درجة الفرصة</TableHead>
                <TableHead>درجة المخاطرة</TableHead>
                <TableHead>التوصية</TableHead>
                <TableHead>المصدر</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {analyses.map((a) => (
                <TableRow key={a.id}>
                  <TableCell>
                    <Button nativeButton={false} variant="link" className="h-auto p-0 font-medium" render={<Link href={`/analysis/${a.id}`}>{a.product.nameAr}</Link>} />
                  </TableCell>
                  <TableCell className="text-foreground/80">{a.market.countryNameAr}</TableCell>
                  <TableCell className="font-mono text-foreground/80">{a.year}</TableCell>
                  <TableCell className="font-mono text-foreground/80">{a.opportunityScore}</TableCell>
                  <TableCell className="font-mono text-foreground/80">{a.riskScore}</TableCell>
                  <TableCell>
                    <Badge className={recStyle[a.recommendation]}>{recLabel[a.recommendation]}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={a.source === "AI" ? "bg-violet-100 text-violet-700 hover:bg-violet-100" : "bg-secondary text-secondary-foreground hover:bg-secondary"}>
                      {a.source === "AI" ? "🤖 AI" : "يدوي"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <Pagination currentPage={page} totalPages={totalPages} basePath="/analysis" />
    </main>
  );
}
