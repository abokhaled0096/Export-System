import Link from "next/link";
import { getScopedPrisma } from "@/lib/scoped-prisma";
import { getCurrentOrgId } from "@/lib/org";
import { requireCurrentUser } from "@/lib/session";
import { requirePermission } from "@/lib/permissions";
import { archiveProduct } from "./actions";
import { PAGE_SIZE, parsePage } from "@/lib/pagination";
import Pagination from "@/components/Pagination";
import ListSearch from "@/components/ListSearch";
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
import type { Prisma } from "@/generated/prisma/client";
import type { ProductStatus } from "@/generated/prisma/enums";

export const dynamic = "force-dynamic";

const statusLabel: Record<string, string> = {
  Draft: "مسودة",
  Verified: "موثّق",
  NeedsReview: "يحتاج مراجعة",
};

const statusStyle: Record<string, string> = {
  Draft: "bg-secondary text-secondary-foreground hover:bg-secondary",
  Verified: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  NeedsReview: "bg-amber-100 text-amber-700 hover:bg-amber-100",
};

const statuses = Object.keys(statusLabel);

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; status?: string }>;
}) {
  const user = await requireCurrentUser();
  try {
    await requirePermission(user.roleId, "Product", "View");
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
  const { q, status } = await searchParams;
  const page = parsePage((await searchParams).page);

  const where: Prisma.ProductWhereInput = {
    orgId,
    deletedAt: null,
    ...(q
      ? {
          OR: [
            { nameAr: { contains: q, mode: "insensitive" } },
            { nameEn: { contains: q, mode: "insensitive" } },
            { hsCode: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(status && statuses.includes(status) ? { status: status as ProductStatus } : {}),
  };

  // ⚠️ مش Promise.all — كل استعلام من getScopedPrisma() بيفتح transaction لوحده (لازمة RLS)،
  // وتنفيذهم بالتوازي بيتزاحموا على نفس اتصال الـpool ويفشلوا بـ"Unable to start a transaction
  // in the given time" (P2028). راجع BACKLOG.md gotcha.
  const products = await prisma.product.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });
  const total = await prisma.product.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">المنتجات</h1>
          <p className="mt-1 text-sm text-muted-foreground">{total} منتج مسجّل</p>
        </div>
        <div className="flex gap-2">
          <Button
            nativeButton={false}
            variant="outline"
            render={
              <a href={`/products/export?${new URLSearchParams({ ...(q ? { q } : {}), ...(status ? { status } : {}) }).toString()}`}>
                تصدير CSV
              </a>
            }
          />
          <Button nativeButton={false} render={<Link href="/products/new">+ منتج جديد</Link>} />
          <Button nativeButton={false} variant="outline" render={<Link href="/products/import">استيراد CSV</Link>} />
          <Button nativeButton={false} variant="outline" render={<Link href="/products/archived">الأرشيف</Link>} />
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <Button nativeButton={false} variant={!status ? "secondary" : "ghost"} size="sm" render={<Link href={q ? `/products?q=${encodeURIComponent(q)}` : "/products"} />}>
            الكل
          </Button>
          {statuses.map((s) => (
            <Button
              key={s}
              nativeButton={false}
              variant={status === s ? "secondary" : "ghost"}
              size="sm"
              render={<Link href={`/products?status=${s}${q ? `&q=${encodeURIComponent(q)}` : ""}`} />}
            >
              {statusLabel[s]}
            </Button>
          ))}
        </div>
        <ListSearch basePath="/products" q={q} hiddenParams={{ status }} placeholder="اسم، HS Code..." />
      </div>

      {products.length === 0 ? (
        <div className="mt-10 rounded-xl border border-dashed border-border py-16 text-center text-muted-foreground">
          {q || status ? (
            <p>مفيش منتجات مطابقة للفلتر ده.</p>
          ) : (
            <>
              <p>لسه مفيش منتجات مسجّلة.</p>
              <Button nativeButton={false} variant="link" render={<Link href="/products/new">سجّل أول منتج</Link>} />
            </>
          )}
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الاسم</TableHead>
                <TableHead>HS Code</TableHead>
                <TableHead>الفئة</TableHead>
                <TableHead>بلد المنشأ</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <Button nativeButton={false} variant="link" className="h-auto p-0 font-medium" render={<Link href={`/products/${p.id}`}>{p.nameAr}</Link>} />
                    <div className="text-xs text-muted-foreground">{p.nameEn}</div>
                  </TableCell>
                  <TableCell className="font-mono text-foreground/80">{p.hsCode}</TableCell>
                  <TableCell className="text-foreground/80">{p.category}</TableCell>
                  <TableCell className="text-foreground/80">{p.originCountry}</TableCell>
                  <TableCell>
                    <Badge className={statusStyle[p.status]}>{statusLabel[p.status]}</Badge>
                  </TableCell>
                  <TableCell className="text-end">
                    <form action={archiveProduct.bind(null, p.id)}>
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
      <Pagination currentPage={page} totalPages={totalPages} basePath="/products" extraParams={{ q, status }} />
    </main>
  );
}
