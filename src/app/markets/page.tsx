import Link from "next/link";
import { getScopedPrisma } from "@/lib/scoped-prisma";
import { getCurrentOrgId } from "@/lib/org";
import { requireCurrentUser } from "@/lib/session";
import { requirePermission } from "@/lib/permissions";
import { archiveMarket } from "./actions";
import { PAGE_SIZE, parsePage } from "@/lib/pagination";
import Pagination from "@/components/Pagination";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const dynamic = "force-dynamic";

export default async function MarketsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const user = await requireCurrentUser();
  try {
    await requirePermission(user.roleId, "Market", "View");
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
  // ⚠️ مش Promise.all — راجع نفس الملاحظة في products/page.tsx (P2028).
  const markets = await prisma.market.findMany({
    where: { orgId, deletedAt: null },
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });
  const total = await prisma.market.count({ where: { orgId, deletedAt: null } });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">الأسواق</h1>
          <p className="mt-1 text-sm text-muted-foreground">{total} سوق مسجّل</p>
        </div>
        <div className="flex gap-2">
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- ده Route Handler بيرجّع
              ملف CSV (Content-Disposition: attachment) مش صفحة. <Link> بيعمل تنقّل client-side
              وبيكسر التنزيل. */}
          <Button nativeButton={false} variant="outline" render={<a href="/markets/export">تصدير CSV</a>} />
          <Button nativeButton={false} render={<Link href="/markets/new">+ سوق جديد</Link>} />
          <Button nativeButton={false} variant="outline" render={<Link href="/markets/compare">قارن أسواق</Link>} />
          <Button nativeButton={false} variant="outline" render={<Link href="/markets/archived">الأرشيف</Link>} />
        </div>
      </div>

      {markets.length === 0 ? (
        <div className="mt-10 rounded-xl border border-dashed border-border py-16 text-center text-muted-foreground">
          <p>لسه مفيش أسواق مسجّلة.</p>
          <Button nativeButton={false} variant="link" render={<Link href="/markets/new">سجّل أول سوق</Link>} />
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الدولة</TableHead>
                <TableHead>القارة</TableHead>
                <TableHead>العملة</TableHead>
                <TableHead>الموانئ الرئيسية</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {markets.map((m) => (
                <TableRow key={m.id}>
                  <TableCell>
                    <Button nativeButton={false} variant="link" className="h-auto p-0 font-medium" render={<Link href={`/markets/${m.id}`}>{m.countryNameAr}</Link>} />
                    <div className="text-xs text-muted-foreground">
                      {m.countryNameEn} · {m.countryCode}
                    </div>
                  </TableCell>
                  <TableCell className="text-foreground/80">{m.continent}</TableCell>
                  <TableCell className="font-mono text-foreground/80">{m.currency}</TableCell>
                  <TableCell className="text-foreground/80">{m.mainPorts.join("، ") || "—"}</TableCell>
                  <TableCell className="text-end">
                    <form action={archiveMarket.bind(null, m.id)}>
                      <Button type="submit" variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive">
                        أرشفة
                      </Button>
                    </form>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <Pagination currentPage={page} totalPages={totalPages} basePath="/markets" />
    </main>
  );
}
