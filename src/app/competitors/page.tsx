import Link from "next/link";
import { requireCurrentUser } from "@/lib/session";
import { requirePermission } from "@/lib/permissions";
import { getScopedPrisma } from "@/lib/scoped-prisma";
import { PAGE_SIZE, parsePage } from "@/lib/pagination";
import Pagination from "@/components/Pagination";
import DeleteCompetitorButton from "./DeleteCompetitorButton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const dynamic = "force-dynamic";

const monthShort = ["", "ينا", "فبر", "مار", "أبر", "ماي", "يون", "يول", "أغس", "سبت", "أكت", "نوف", "ديس"];

function monthsLabel(months: number[]): string {
  if (months.length === 0) return "—";
  return [...months].sort((a, b) => a - b).map((m) => monthShort[m]).join("، ");
}

export default async function CompetitorsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const user = await requireCurrentUser();

  try {
    await requirePermission(user.roleId, "Competitor", "View");
  } catch {
    return (
      <main className="mx-auto max-w-3xl px-6 py-10">
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-6 text-center text-sm text-destructive">
          معندكش صلاحية الوصول للصفحة دي.
        </div>
      </main>
    );
  }

  const orgId = user.orgId;
  const prisma = await getScopedPrisma();
  const page = parsePage((await searchParams).page);

  // ⚠️ مش Promise.all — راجع BACKLOG.md (P2028).
  const competitors = await prisma.competitor.findMany({
    where: { orgId, deletedAt: null },
    include: { product: true, market: true },
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });
  const total = await prisma.competitor.count({ where: { orgId, deletedAt: null } });
  const productCount = await prisma.product.count({ where: { orgId, deletedAt: null } });
  const marketCount = await prisma.market.count({ where: { orgId, deletedAt: null } });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const canCreate = productCount > 0 && marketCount > 0;

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">المنافسون</h1>
          <p className="mt-1 text-sm text-muted-foreground">{total} منافس مسجّل</p>
        </div>
        {canCreate ? (
          <div className="flex gap-2">
            <Button nativeButton={false} className="bg-violet-700 text-white hover:bg-violet-800" render={<Link href="/competitors/ai/new">🤖 ابحث بالذكاء الاصطناعي</Link>} />
            <Button nativeButton={false} variant="outline" render={<Link href="/competitors/new">+ منافس يدوي</Link>} />
          </div>
        ) : (
          <span className="rounded-lg bg-muted px-4 py-2 text-sm text-muted-foreground">محتاج منتج وسوق الأول</span>
        )}
      </div>

      {!canCreate && (
        <p className="mt-4 w-fit rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
          سجّل <Link href="/products/new" className="underline">منتج</Link> و
          <Link href="/markets/new" className="underline">سوق</Link> الأول عشان تقدر تضيف منافس.
        </p>
      )}

      {competitors.length === 0 ? (
        <div className="mt-10 rounded-xl border border-dashed border-border py-16 text-center text-muted-foreground">
          لسه مفيش منافسين مسجّلين.
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>المنتج</TableHead>
                <TableHead>السوق</TableHead>
                <TableHead>الدولة المنافسة</TableHead>
                <TableHead>شهور القوة</TableHead>
                <TableHead>شهور الضعف</TableHead>
                <TableHead>نطاق السعر</TableHead>
                <TableHead>المصدر</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {competitors.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="text-foreground/80">{c.product.nameAr}</TableCell>
                  <TableCell className="text-foreground/80">{c.market.countryNameAr}</TableCell>
                  <TableCell className="font-medium text-foreground">{c.countryName}</TableCell>
                  <TableCell className="text-xs text-emerald-700">{monthsLabel(c.strengthMonths)}</TableCell>
                  <TableCell className="text-xs text-rose-700">{monthsLabel(c.weaknessMonths)}</TableCell>
                  <TableCell className="font-mono text-xs text-foreground/80">
                    {c.priceRangeMin || c.priceRangeMax
                      ? `${c.priceRangeMin?.toFixed(2) ?? "؟"}–${c.priceRangeMax?.toFixed(2) ?? "؟"} ${c.currency}`
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge className={c.source === "AI" ? "bg-violet-100 text-violet-700 hover:bg-violet-100" : "bg-secondary text-secondary-foreground hover:bg-secondary"}>
                      {c.source === "AI" ? "🤖 AI" : "يدوي"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DeleteCompetitorButton competitorId={c.id} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <Pagination currentPage={page} totalPages={totalPages} basePath="/competitors" />

      <p className="mt-4 text-xs text-muted-foreground">
        🤖 بيانات الذكاء الاصطناعي بحث آلي حقيقي (مش تخمين) — بس لسه بحث آلي، راجعها قبل ما تبني عليها قرار مهم. أي صف غير دقيق ينفع يتشال.
      </p>
    </main>
  );
}
