import Link from "next/link";
import { getScopedPrisma } from "@/lib/scoped-prisma";
import { requireCurrentUser } from "@/lib/session";
import { requirePermission } from "@/lib/permissions";
import { restoreProduct } from "../actions";
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

export default async function ArchivedProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const user = await requireCurrentUser();

  // ⚠️ القائمة الرئيسية (/products) بقى فيها فحص Product.View (مراجعة وحدة 1 السابقة)، لكن
  // نسخة الأرشيف اتنسيت وقتها — اتكشف في إعادة المراجعة (7 سبتمبر).
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

  const orgId = user.orgId;
  const prisma = await getScopedPrisma();
  const page = parsePage((await searchParams).page);
  const where = { orgId, deletedAt: { not: null } };

  const products = await prisma.product.findMany({
    where,
    orderBy: { deletedAt: "desc" },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });
  const total = await prisma.product.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">المنتجات المؤرشفة</h1>
          <p className="mt-1 text-sm text-muted-foreground">{total} منتج مؤرشف</p>
        </div>
        <Button nativeButton={false} variant="outline" render={<Link href="/products">← رجوع للمنتجات</Link>} />
      </div>

      {products.length === 0 ? (
        <div className="mt-10 rounded-xl border border-dashed border-border py-16 text-center text-muted-foreground">
          <p>مفيش منتجات مؤرشفة دلوقتي.</p>
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الاسم</TableHead>
                <TableHead>HS Code</TableHead>
                <TableHead>الفئة</TableHead>
                <TableHead>تاريخ الأرشفة</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <div className="font-medium text-foreground">{p.nameAr}</div>
                    <div className="text-xs text-muted-foreground">{p.nameEn}</div>
                  </TableCell>
                  <TableCell className="font-mono text-foreground/80">{p.hsCode}</TableCell>
                  <TableCell className="text-foreground/80">{p.category}</TableCell>
                  <TableCell className="text-foreground/80">
                    {p.deletedAt?.toLocaleDateString("ar-EG")}
                  </TableCell>
                  <TableCell className="text-end">
                    <form action={restoreProduct.bind(null, p.id)}>
                      <Button type="submit" variant="ghost" size="sm">
                        استعادة
                      </Button>
                    </form>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <Pagination currentPage={page} totalPages={totalPages} basePath="/products/archived" />
    </main>
  );
}
