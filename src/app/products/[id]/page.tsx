import Link from "next/link";
import { notFound } from "next/navigation";
import { getScopedPrisma } from "@/lib/scoped-prisma";
import { getCurrentOrgId } from "@/lib/org";
import { requireCurrentUser } from "@/lib/session";
import { requirePermission } from "@/lib/permissions";
import ProductSpecificationForm from "./ProductSpecificationForm";
import ProductEditForm from "./ProductEditForm";
import { productSpecificationStatusLabel, productSpecificationStatusStyle } from "@/lib/specificationLabels";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

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

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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

  const product = await prisma.product.findFirst({
    where: { id, orgId, deletedAt: null },
    include: {
      specifications: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!product) notFound();

  // الانتقالات المسموحة بقت في جدول WorkflowDefinition (وحدة 9) — كانت الحالة قابلة للتغيير
  // بحرية لأي قيمة قبل كده بلا أي فحص (اتكشف في إعادة مراجعة وحدة 1، 7 سبتمبر). بتتقرا هنا
  // وتتبعت لـProductEditForm عشان قائمة الاختيار تعرض بس الانتقالات المسموحة + الحالة الحالية.
  const allowedNextStatuses = await prisma.workflowDefinition.findMany({
    where: { orgId, entityType: "Product", fromStage: product.status },
    select: { toStage: true },
  });

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <Button nativeButton={false} variant="link" className="px-0" render={<Link href="/products">← رجوع للمنتجات</Link>} />

      <div className="mt-3 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{product.nameAr}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {product.nameEn} · {product.hsCode} · {product.category}
          </p>
        </div>
        <Badge className={statusStyle[product.status]}>{statusLabel[product.status]}</Badge>
      </div>

      <dl className="mt-4 grid gap-4 rounded-xl border border-border bg-card p-5 sm:grid-cols-3">
        <div>
          <dt className="text-xs text-muted-foreground">بلد المنشأ</dt>
          <dd className="text-foreground">{product.originCountry}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">موسم الحصاد</dt>
          <dd className="text-foreground">{product.harvestSeason ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">مدة الصلاحية</dt>
          <dd className="text-foreground">{product.shelfLifeDays ? `${product.shelfLifeDays} يوم` : "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">يحتاج تبريد</dt>
          <dd className="text-foreground">{product.requiresRefrigeration ? "نعم" : "لا"}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">درجة حرارة التخزين</dt>
          <dd className="text-foreground">{product.storageTempC ? `${product.storageTempC}°C` : "—"}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-xs text-muted-foreground">شهور توفّر المنتج عندنا</dt>
          <dd className="text-foreground">
            {product.availableMonths.length > 0
              ? [...product.availableMonths].sort((a, b) => a - b).join("، ")
              : "غير مسجّلة"}
          </dd>
        </div>
      </dl>

      <section className="mt-8">
        <h2 className="text-lg font-medium text-foreground">تعديل حالة التوثيق والمواسم</h2>
        <div className="mt-3">
          <ProductEditForm
            productId={product.id}
            status={product.status}
            allowedNextStatuses={allowedNextStatuses.map((t) => t.toStage)}
            availableMonths={product.availableMonths}
            storageTempC={product.storageTempC ? Number(product.storageTempC) : null}
          />
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-medium text-foreground">المواصفات</h2>
        <div className="mt-3">
          <ProductSpecificationForm productId={product.id} />
        </div>
        <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>النسخة</TableHead>
                <TableHead>ظروف التخزين</TableHead>
                <TableHead>مدة الصلاحية (يوم)</TableHead>
                <TableHead>تاريخ المراجعة</TableHead>
                <TableHead>الحالة</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {product.specifications.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-6 text-center text-muted-foreground">
                    لسه مفيش مواصفات مسجّلة.
                  </TableCell>
                </TableRow>
              ) : (
                product.specifications.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-mono text-foreground">{s.version}</TableCell>
                    <TableCell className="text-foreground/80">{s.storageConditions ?? "—"}</TableCell>
                    <TableCell className="font-mono text-foreground/80">{s.shelfLifeDays ?? "—"}</TableCell>
                    <TableCell className="text-foreground/80">{s.reviewDate ? s.reviewDate.toLocaleDateString("ar-EG") : "—"}</TableCell>
                    <TableCell>
                      <Badge className={productSpecificationStatusStyle[s.status]}>{productSpecificationStatusLabel[s.status]}</Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>
    </main>
  );
}
