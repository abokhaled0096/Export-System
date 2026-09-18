import Link from "next/link";
import { requireCurrentUser } from "@/lib/session";
import { requirePermission } from "@/lib/permissions";
import { getScopedPrisma } from "@/lib/scoped-prisma";
import FixedAssetForm, { type CostCenterOption } from "./FixedAssetForm";
import { fixedAssetCategoryLabel, fixedAssetStatusLabel, fixedAssetStatusStyle } from "@/lib/treasuryLabels";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PAGE_SIZE, parsePage } from "@/lib/pagination";
import Pagination from "@/components/Pagination";

export const dynamic = "force-dynamic";

export default async function FixedAssetsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const user = await requireCurrentUser();

  try {
    await requirePermission(user.roleId, "FixedAsset", "View");
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
  const where = { orgId };

  // ⚠️ مش Promise.all — راجع BACKLOG.md (P2028).
  const assets = await prisma.fixedAsset.findMany({
    where,
    orderBy: { purchaseDate: "desc" },
    include: { costCenter: { select: { name: true } } },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });
  const total = await prisma.fixedAsset.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const costCenters = await prisma.costCenter.findMany({ where: { orgId }, orderBy: { code: "asc" }, select: { id: true, code: true, name: true } });
  const org = await prisma.organization.findUniqueOrThrow({ where: { id: orgId }, select: { functionalCurrency: true } });

  const costCenterOptions: CostCenterOption[] = costCenters.map((c) => ({ id: c.id, label: `${c.code} — ${c.name}` }));

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">الأصول الثابتة</h1>
          <p className="mt-1 text-sm text-muted-foreground">{total} أصل</p>
        </div>
        <Link href="/accounting/depreciation" className="text-sm text-primary hover:underline">
          تشغيل الإهلاك الدوري ←
        </Link>
      </div>

      <div className="mt-6">
        <FixedAssetForm costCenters={costCenterOptions} functionalCurrency={org.functionalCurrency ?? undefined} />
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>الكود</TableHead>
              <TableHead>الاسم</TableHead>
              <TableHead>الفئة</TableHead>
              <TableHead>مركز التكلفة</TableHead>
              <TableHead>قيمة الشراء</TableHead>
              <TableHead>مجمّع الإهلاك</TableHead>
              <TableHead>القيمة الدفترية الصافية</TableHead>
              <TableHead>الحالة</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {assets.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-6 text-center text-muted-foreground">
                  لسه مفيش أصول ثابتة مسجّلة.
                </TableCell>
              </TableRow>
            ) : (
              assets.map((a) => (
                <TableRow key={a.id}>
                  <TableCell>
                    <Link href={`/accounting/fixed-assets/${a.id}`} className="font-mono text-primary hover:underline">
                      {a.assetCode}
                    </Link>
                  </TableCell>
                  <TableCell className="text-foreground/80">{a.nameAr}</TableCell>
                  <TableCell className="text-foreground/80">{fixedAssetCategoryLabel[a.category]}</TableCell>
                  <TableCell className="text-foreground/80">{a.costCenter?.name ?? "—"}</TableCell>
                  <TableCell className="font-mono text-foreground/80">
                    {a.purchaseValue.toFixed(2)} {a.currency}
                  </TableCell>
                  <TableCell className="font-mono text-foreground/80">{a.accumulatedDepreciation.toFixed(2)}</TableCell>
                  <TableCell className="font-mono font-semibold text-foreground">{a.netBookValue.toFixed(2)}</TableCell>
                  <TableCell>
                    <Badge className={fixedAssetStatusStyle[a.status]}>{fixedAssetStatusLabel[a.status]}</Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <Pagination currentPage={page} totalPages={totalPages} basePath="/accounting/fixed-assets" />
    </main>
  );
}
