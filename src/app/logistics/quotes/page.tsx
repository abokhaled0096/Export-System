import Link from "next/link";
import { requireCurrentUser } from "@/lib/session";
import { requirePermission } from "@/lib/permissions";
import { getScopedPrisma } from "@/lib/scoped-prisma";
import FreightQuoteForm from "./FreightQuoteForm";
import { freightQuoteStatusLabel, freightQuoteStatusStyle } from "@/lib/logisticsLabels";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const dynamic = "force-dynamic";

export default async function FreightQuotesPage() {
  const user = await requireCurrentUser();

  try {
    await requirePermission(user.roleId, "FreightQuote", "View");
  } catch {
    return (
      <main className="mx-auto max-w-3xl px-6 py-10">
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-6 text-center text-sm text-destructive">
          معندكش صلاحية الوصول للصفحة دي — متاحة لـLogisticsOfficer/Admin/CompanyOwner.
        </div>
      </main>
    );
  }

  const prisma = await getScopedPrisma();
  // ⚠️ مش Promise.all — راجع BACKLOG.md (P2028).
  const quotes = await prisma.freightQuote.findMany({
    where: { orgId: user.orgId },
    include: { route: true, provider: true, lines: true },
    orderBy: { createdAt: "desc" },
  });
  const routes = await prisma.route.findMany({ where: { orgId: user.orgId }, select: { id: true, originPort: true, destinationPort: true }, orderBy: { originPort: "asc" } });
  const providers = await prisma.serviceProvider.findMany({ where: { orgId: user.orgId }, select: { id: true, name: true }, orderBy: { name: "asc" } });

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <Button nativeButton={false} variant="link" className="px-0" render={<Link href="/logistics">← رجوع للوجستيات</Link>} />

      <div className="mt-3">
        <h1 className="text-2xl font-semibold text-foreground">عروض أسعار الشحن</h1>
        <p className="mt-1 text-sm text-muted-foreground">{quotes.length} عرض مسجّل</p>
      </div>

      {routes.length === 0 || providers.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          محتاج خط شحن ومزوّد خدمة مسجَّلين الأول —
          <Button nativeButton={false} variant="link" render={<Link href="/logistics/routes">خطوط الشحن</Link>} /> /
          <Button nativeButton={false} variant="link" render={<Link href="/logistics/providers">مزوّدو الخدمة</Link>} />
        </div>
      ) : (
        <div className="mt-6">
          <FreightQuoteForm routes={routes} providers={providers} />
        </div>
      )}

      <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>الخط</TableHead>
              <TableHead>المزوّد</TableHead>
              <TableHead>إجمالي التكلفة</TableHead>
              <TableHead>مدة الشحن</TableHead>
              <TableHead>الحالة</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {quotes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-6 text-center text-muted-foreground">
                  لسه مفيش عروض أسعار مسجّلة.
                </TableCell>
              </TableRow>
            ) : (
              quotes.map((q) => {
                const total = q.lines.reduce((sum, l) => sum + Number(l.amount), 0);
                return (
                  <TableRow key={q.id}>
                    <TableCell>
                      <Button
                        nativeButton={false}
                        variant="link"
                        className="h-auto p-0 font-medium"
                        render={<Link href={`/logistics/quotes/${q.id}`}>{q.route.originPort} ← {q.route.destinationPort}</Link>}
                      />
                    </TableCell>
                    <TableCell className="text-foreground/80">{q.provider.name}</TableCell>
                    <TableCell className="font-mono text-foreground/80">
                      {q.lines.length > 0 ? `${total.toFixed(2)} ${q.lines[0].currency ?? q.currency ?? ""}` : "—"}
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
    </main>
  );
}
