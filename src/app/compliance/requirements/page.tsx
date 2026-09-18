import Link from "next/link";
import { requireCurrentUser } from "@/lib/session";
import { requirePermission } from "@/lib/permissions";
import { getScopedPrisma } from "@/lib/scoped-prisma";
import RequirementSearchForm from "./RequirementSearchForm";
import { requirementCategoryLabel, requirementStatusLabel, requirementStatusStyle } from "@/lib/complianceLabels";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import ProductMarketFilterForm from "./ProductMarketFilterForm";
import { PAGE_SIZE, parsePage } from "@/lib/pagination";
import Pagination from "@/components/Pagination";

export const dynamic = "force-dynamic";

/**
 * بحث متطلبات مبكر — "إيه متطلبات دخول منتج X لسوق Y؟" قبل ما تكون فيه صفقة أصلًا.
 * راجع docs/ERD.md §8 ملاحظة 🆕v3.1 وdocs/SCOPE-P5.md.
 */
export default async function ComplianceRequirementsPage({
  searchParams,
}: {
  searchParams: Promise<{ productId?: string; marketId?: string; page?: string }>;
}) {
  const user = await requireCurrentUser();

  try {
    await requirePermission(user.roleId, "Requirement", "Create");
  } catch {
    return (
      <main className="mx-auto max-w-3xl px-6 py-10">
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-6 text-center text-sm text-destructive">
          معندكش صلاحية الوصول للصفحة دي.
        </div>
      </main>
    );
  }

  const { productId, marketId } = await searchParams;
  const page = parsePage((await searchParams).page);
  const orgId = user.orgId;
  const prisma = await getScopedPrisma();

  const products = await prisma.product.findMany({ where: { orgId, deletedAt: null }, orderBy: { nameAr: "asc" } });
  const markets = await prisma.market.findMany({ where: { orgId, deletedAt: null }, orderBy: { countryNameAr: "asc" } });

  const requirementsWhere = { orgId, productId: productId as string, marketId: marketId as string, complianceCaseId: null };
  const requirements =
    productId && marketId
      ? await prisma.requirement.findMany({
          where: requirementsWhere,
          orderBy: { createdAt: "desc" },
          skip: (page - 1) * PAGE_SIZE,
          take: PAGE_SIZE,
        })
      : [];
  const total =
    productId && marketId ? await prisma.requirement.count({ where: requirementsWhere }) : 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <Button nativeButton={false} variant="link" className="px-0" render={<Link href="/compliance">← رجوع لملفات الامتثال</Link>} />
      <h1 className="mt-3 text-2xl font-semibold text-foreground">بحث متطلبات مبكر</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        سجّل متطلبات دخول منتج لسوق معيّن قبل ما تكون فيه صفقة أصلًا — دي متطلبات مستقلة (بلا ملف
        امتثال)، محتاجة تتسجّل تاني يدويًا جوه ملف الامتثال لو اتفتحت صفقة بنفس المنتج/السوق لاحقًا.
      </p>

      <div className="mt-6">
        <ProductMarketFilterForm
          products={products.map((p) => ({ id: p.id, label: p.nameAr }))}
          markets={markets.map((m) => ({ id: m.id, label: m.countryNameAr }))}
          selectedProductId={productId}
          selectedMarketId={marketId}
        />
      </div>

      {productId && marketId && (
        <div className="mt-4">
          <RequirementSearchForm
            products={products.map((p) => ({ id: p.id, label: p.nameAr }))}
            markets={markets.map((m) => ({ id: m.id, label: m.countryNameAr }))}
            defaultProductId={productId}
            defaultMarketId={marketId}
          />
        </div>
      )}

      {productId && marketId && (
        <div className="mt-6 overflow-x-auto rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الفئة</TableHead>
                <TableHead>المتطلب</TableHead>
                <TableHead>إلزامي</TableHead>
                <TableHead>الحالة</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requirements.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-6 text-center text-muted-foreground">
                    لسه مفيش متطلبات مسجّلة للزوج ده.
                  </TableCell>
                </TableRow>
              ) : (
                requirements.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-foreground/80">{requirementCategoryLabel[r.category]}</TableCell>
                    <TableCell className="font-medium text-foreground">{r.name}</TableCell>
                    <TableCell className="text-foreground/80">{r.mandatory ? "نعم" : "لا"}</TableCell>
                    <TableCell>
                      <Badge className={requirementStatusStyle[r.status]}>{requirementStatusLabel[r.status]}</Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}
      {productId && marketId && (
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          basePath="/compliance/requirements"
          extraParams={{ productId, marketId }}
        />
      )}
    </main>
  );
}
