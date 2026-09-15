import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCurrentUser } from "@/lib/session";
import { requirePermission } from "@/lib/permissions";
import { getScopedPrisma } from "@/lib/scoped-prisma";
import { containerTypeLabel, freightQuoteStatusLabel, freightQuoteStatusStyle, routeClassificationLabel, routeClassificationStyle, transportModeLabel } from "@/lib/logisticsLabels";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const dynamic = "force-dynamic";

/** بيحسب إجمالي تكلفة عرض السعر — مجموع كل البنود، مش بس أجرة الشحن الأساسية. ده اللي المستخدم
 * فعليًا محتاج يقارن بيه، مش رقم واحد ناقص. */
function totalCost(q: { originCharges: unknown; mainFreight: unknown; destinationCharges: unknown; insurance: unknown }): number {
  const n = (v: unknown) => (v === null || v === undefined ? 0 : Number(v));
  return n(q.originCharges) + n(q.mainFreight) + n(q.destinationCharges) + n(q.insurance);
}

export default async function RouteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireCurrentUser();

  try {
    await requirePermission(user.roleId, "Route", "View");
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
  const route = await prisma.route.findFirst({ where: { id, orgId: user.orgId } });
  if (!route) notFound();

  // ⚠️ مش Promise.all — راجع BACKLOG.md (P2028).
  const quotes = await prisma.freightQuote.findMany({
    where: { routeId: id, orgId: user.orgId },
    include: { provider: true },
    orderBy: { createdAt: "desc" },
  });

  // أرخص عرض سعر لكل نوع حاوية — ده اللي المستخدم فعليًا بيدوّر عليه لما يقارن. حاوية بلا نوع
  // محدَّد (null) بتتحسب لوحدها تحت مفتاح "غير محدَّد".
  const cheapestByContainer = new Map<string, string>(); // containerType -> quoteId
  for (const q of quotes) {
    if (q.status !== "Approved") continue; // مسودة/منتهي الصلاحية مش مقارنة عادلة.
    const key = q.containerType ?? "—";
    const current = cheapestByContainer.get(key);
    if (!current) {
      cheapestByContainer.set(key, q.id);
      continue;
    }
    const currentQuote = quotes.find((x) => x.id === current)!;
    if (totalCost(q) < totalCost(currentQuote)) cheapestByContainer.set(key, q.id);
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <Button nativeButton={false} variant="link" className="px-0" render={<Link href="/logistics/routes">← رجوع لخطوط الشحن</Link>} />

      <div className="mt-3 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-foreground">
          {route.originPort} ← {route.destinationPort}
        </h1>
        <Badge className={routeClassificationStyle[route.classification]}>{routeClassificationLabel[route.classification]}</Badge>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        {route.transportModes.map((m) => transportModeLabel[m] ?? m).join("، ") || "وسيلة نقل غير محدَّدة"}
        {route.typicalTransitDays ? ` — مدة معتادة ${route.typicalTransitDays} يوم` : ""}
        {route.weeklySailings ? ` — ${route.weeklySailings} رحلة أسبوعيًا` : ""}
      </p>
      {route.transitPorts.length > 0 && <p className="mt-1 text-xs text-muted-foreground">موانئ عبور: {route.transitPorts.join("، ")}</p>}

      <section className="mt-8">
        <h2 className="text-lg font-medium text-foreground">مقارنة شركات الشحن على هذا الخط</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {quotes.length} عرض سعر مسجَّل — الأرخص لكل نوع حاوية (بين العروض المعتمدة) معلَّم بـ🏆. الإجمالي = مصاريف المنشأ + أجرة الشحن + مصاريف الوصول + التأمين.
        </p>

        <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>شركة الشحن</TableHead>
                <TableHead>نوع الحاوية</TableHead>
                <TableHead>مصاريف المنشأ</TableHead>
                <TableHead>أجرة الشحن</TableHead>
                <TableHead>مصاريف الوصول</TableHead>
                <TableHead>التأمين</TableHead>
                <TableHead>الإجمالي</TableHead>
                <TableHead>مدة الشحن</TableHead>
                <TableHead>الحالة</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {quotes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="py-6 text-center text-muted-foreground">
                    لسه مفيش عروض أسعار مسجّلة على الخط ده —{" "}
                    <Link href="/logistics/quotes" className="text-primary hover:underline">
                      سجّل عرض سعر
                    </Link>
                  </TableCell>
                </TableRow>
              ) : (
                quotes.map((q) => {
                  const isCheapest = cheapestByContainer.get(q.containerType ?? "—") === q.id;
                  return (
                    <TableRow key={q.id} className={isCheapest ? "bg-emerald-50" : undefined}>
                      <TableCell className="text-foreground/80">
                        {isCheapest && <span className="ml-1">🏆</span>}
                        {q.provider.name}
                      </TableCell>
                      <TableCell className="text-foreground/80">{q.containerType ? containerTypeLabel[q.containerType] : "—"}</TableCell>
                      <TableCell className="font-mono text-foreground/80">{q.originCharges ? Number(q.originCharges).toLocaleString() : "—"}</TableCell>
                      <TableCell className="font-mono text-foreground/80">{q.mainFreight ? Number(q.mainFreight).toLocaleString() : "—"}</TableCell>
                      <TableCell className="font-mono text-foreground/80">{q.destinationCharges ? Number(q.destinationCharges).toLocaleString() : "—"}</TableCell>
                      <TableCell className="font-mono text-foreground/80">{q.insurance ? Number(q.insurance).toLocaleString() : "—"}</TableCell>
                      <TableCell className="font-mono font-medium text-foreground">
                        {totalCost(q).toLocaleString()} {q.currency ?? ""}
                      </TableCell>
                      <TableCell className="font-mono text-foreground/80">{q.transitDays ? `${q.transitDays} يوم` : "—"}</TableCell>
                      <TableCell>
                        <Badge className={freightQuoteStatusStyle[q.status]}>{freightQuoteStatusLabel[q.status]}</Badge>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      <p className="mt-4 text-xs text-muted-foreground">
        عشان تحجز فعليًا: افتح الشحنة المرتبطة من <Link href="/logistics" className="text-primary hover:underline">اللوجستيات</Link>، وأضف Booking فيها باختيار شركة الشحن وعرض السعر اللي قرّرته هنا.
      </p>
    </main>
  );
}
