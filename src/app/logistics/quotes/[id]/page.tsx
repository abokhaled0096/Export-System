import Link from "next/link";
import { notFound } from "next/navigation";
import { getScopedPrisma } from "@/lib/scoped-prisma";
import { getCurrentOrgId } from "@/lib/org";
import FreightQuoteLineForm from "./FreightQuoteLineForm";
import {
  freightQuoteStatusLabel,
  freightQuoteStatusStyle,
  freightQuoteLineCategoryLabel,
  containerTypeLabel,
} from "@/lib/logisticsLabels";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const dynamic = "force-dynamic";

export default async function FreightQuoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const orgId = await getCurrentOrgId();
  const prisma = await getScopedPrisma();

  const quote = await prisma.freightQuote.findFirst({
    where: { id, orgId },
    include: { route: true, provider: true, lines: { orderBy: { createdAt: "asc" } } },
  });
  if (!quote) notFound();

  const total = quote.lines.reduce((sum, l) => sum + Number(l.amount), 0);
  const currency = quote.lines[0]?.currency ?? quote.currency ?? "";

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <Button nativeButton={false} variant="link" className="px-0" render={<Link href="/logistics/quotes">← رجوع لعروض أسعار الشحن</Link>} />

      <div className="mt-3 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            {quote.route.originPort} ← {quote.route.destinationPort}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {quote.provider.name}
            {quote.containerType ? ` · ${containerTypeLabel[quote.containerType]}` : ""}
          </p>
        </div>
        <Badge className={freightQuoteStatusStyle[quote.status]}>{freightQuoteStatusLabel[quote.status]}</Badge>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 rounded-xl border border-border bg-card p-4 sm:grid-cols-4">
        <div>
          <p className="text-xs text-muted-foreground">مصاريف المنشأ</p>
          <p className="font-mono text-foreground">{quote.originCharges ? quote.originCharges.toString() : "—"}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">أجرة الشحن</p>
          <p className="font-mono text-foreground">{quote.mainFreight ? quote.mainFreight.toString() : "—"}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">مصاريف الوصول</p>
          <p className="font-mono text-foreground">{quote.destinationCharges ? quote.destinationCharges.toString() : "—"}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">التأمين</p>
          <p className="font-mono text-foreground">{quote.insurance ? quote.insurance.toString() : "—"}</p>
        </div>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        الأربعة أرقام دي للعرض السريع بس — التفصيل الفعلي في بنود التكلفة تحت، وإجمالي التكلفة الحقيقي بيتحسب من مجموعها.
      </p>

      <section className="mt-8">
        <h2 className="text-lg font-medium text-foreground">بنود التكلفة</h2>
        <div className="mt-3">
          <FreightQuoteLineForm freightQuoteId={quote.id} />
        </div>
        <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الكود</TableHead>
                <TableHead>الفئة</TableHead>
                <TableHead>المبلغ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {quote.lines.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="py-6 text-center text-muted-foreground">
                    لسه مفيش بنود تكلفة مسجّلة.
                  </TableCell>
                </TableRow>
              ) : (
                quote.lines.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="font-mono text-foreground">{l.chargeCode}</TableCell>
                    <TableCell className="text-foreground/80">{freightQuoteLineCategoryLabel[l.category]}</TableCell>
                    <TableCell className="font-mono text-foreground/80">
                      {l.amount.toString()} {l.currency ?? ""}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
            {quote.lines.length > 0 && (
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={2} className="font-medium text-foreground">
                    إجمالي التكلفة الفعلي (⚙️)
                  </TableCell>
                  <TableCell className="font-mono font-medium text-foreground">
                    {total.toFixed(2)} {currency}
                  </TableCell>
                </TableRow>
              </TableFooter>
            )}
          </Table>
        </div>
      </section>
    </main>
  );
}
