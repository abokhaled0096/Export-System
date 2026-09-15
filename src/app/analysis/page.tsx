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
  // supersededAt: null — النسخة النشطة بس (راجع migration 20260909120000). النسخ القديمة لنفس
  // التركيبة محفوظة في القاعدة للتاريخ، بس مش معروضة هنا افتراضيًا عشان القايمة متبقاش مليانة
  // تكرارات لنفس (منتج × سوق × سنة).
  // product/market.deletedAt: null كمان — أرشفة منتج أو سوق (Phase 0، 9 سبتمبر) لازم تشيل
  // تحليلاته القديمة من القايمة الافتراضية برضه، وإلا أرشفة الاختبار بتفضل ظاهرة هنا رغم
  // اختفائها من /products و/markets (اتلاحظ حيًا فورًا بعد أرشفة 5 منتجات اختبار).
  const activeAnalysisFilter = { orgId, supersededAt: null, product: { deletedAt: null }, market: { deletedAt: null } } as const;
  const analyses = await prisma.productMarketAnalysis.findMany({
    where: activeAnalysisFilter,
    include: { product: true, market: true },
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });
  const total = await prisma.productMarketAnalysis.count({ where: activeAnalysisFilter });
  const productCount = await prisma.product.count({ where: { orgId, deletedAt: null } });
  const verifiedProducts = await prisma.product.findMany({ where: { orgId, deletedAt: null, status: "Verified" }, select: { id: true, nameAr: true }, orderBy: { nameAr: "asc" } });
  const marketsForBulk = await prisma.market.findMany({ where: { orgId, deletedAt: null }, select: { id: true, countryNameAr: true }, orderBy: { countryNameAr: "asc" } });
  const verifiedProductCount = verifiedProducts.length;
  const marketCount = marketsForBulk.length;
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

      {canCreate && verifiedProductCount > 0 && (
        <div className="mt-4">
          <BulkAnalysisButton
            action={startMarketAnalysisBatchAction}
            label="📊 حلّل كل المنتجات × كل الأسواق"
            description={`اختار المنتجات والأسواق اللي عايز تحلّلها (حد أقصى 50 تركيبة) — منتجات Draft متستبعدة عمدًا عشان محتاج تراجع بياناتها الأول، وتركيبة عندها تحليل حديث لسه صالح بتتستبعد تلقائيًا برضه. ممكن ياخد لغاية 20-25 دقيقة، وشريط تقدّم حي هيظهرلك أول بأول.`}
            colorClass="bg-indigo-700 text-white hover:bg-indigo-800"
            products={verifiedProducts.map((p) => ({ id: p.id, label: p.nameAr }))}
            markets={marketsForBulk.map((m) => ({ id: m.id, label: m.countryNameAr }))}
            showForceRefresh
          />
        </div>
      )}

      {canCreate && verifiedProductCount === 0 && (
        <p className="mt-4 w-fit rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
          التحليل الشامل محتاج منتج واحد على الأقل بحالة &quot;Verified&quot; — كل منتجاتك لسه Draft. راجع بيانات المنتج وغيّر حالته من صفحة تفاصيله.
        </p>
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
                <TableHead>الحداثة</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {analyses.map((a) => {
                const isStale = a.validUntil !== null && a.validUntil < new Date();
                return (
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
                      <div className="flex items-center gap-1.5">
                        <Badge className={a.source === "AI" ? "bg-violet-100 text-violet-700 hover:bg-violet-100" : "bg-secondary text-secondary-foreground hover:bg-secondary"}>
                          {a.source === "AI" ? "🤖 AI" : "يدوي"}
                        </Badge>
                        {a.needsReview && (
                          <Badge className="bg-rose-100 text-rose-700 hover:bg-rose-100" title="تقييم الـAI بعيد عن اقتراح محرك القواعد بأكتر من 25 نقطة">
                            🚩 راجع الرقم
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {isStale ? (
                        <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">⏰ قديم — يحتاج إعادة تحليل</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">حديث</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
      <Pagination currentPage={page} totalPages={totalPages} basePath="/analysis" />
    </main>
  );
}
