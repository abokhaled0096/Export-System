import Link from "next/link";
import { Prisma } from "@/generated/prisma/client";
import { requireCurrentUser } from "@/lib/session";
import { requirePermission } from "@/lib/permissions";
import { getScopedPrisma } from "@/lib/scoped-prisma";
import RunDepreciationButton from "./RunDepreciationButton";
import { computeStraightLineDepreciation } from "@/lib/depreciation";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const dynamic = "force-dynamic";

type Search = Promise<{ period?: string }>;

export default async function DepreciationPage({ searchParams }: { searchParams: Search }) {
  const { period: selectedPeriodId } = await searchParams;
  const user = await requireCurrentUser();

  try {
    await requirePermission(user.roleId, "DepreciationEntry", "View");
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

  const periods = await prisma.accountingPeriod.findMany({
    where: { orgId, status: "Open" },
    orderBy: { startDate: "desc" },
    select: { id: true, periodName: true, startDate: true, endDate: true },
  });

  const period = periods.find((p) => p.id === selectedPeriodId) ?? periods[0];

  if (!period) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-10">
        <h1 className="text-2xl font-semibold text-foreground">تشغيل الإهلاك الدوري</h1>
        <p className="mt-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          مفيش فترة محاسبية مفتوحة — افتح فترة الأول من صفحة الفترات المحاسبية.
        </p>
      </main>
    );
  }

  // ⚠️ مش Promise.all — راجع BACKLOG.md (P2028).
  const assets = await prisma.fixedAsset.findMany({
    where: { orgId, status: "Active" },
    orderBy: { assetCode: "asc" },
  });
  const alreadyPosted = await prisma.depreciationEntry.findMany({
    where: { orgId, period: period.periodName },
    select: { assetId: true },
  });
  const postedIds = new Set(alreadyPosted.map((d) => d.assetId));

  const preview = assets.map((a) => {
    const done = postedIds.has(a.id);
    let amount = new Prisma.Decimal(0);
    if (!done) {
      try {
        amount = computeStraightLineDepreciation(a);
      } catch {
        amount = new Prisma.Decimal(0);
      }
    }
    return { asset: a, done, amount };
  });
  const dueCount = preview.filter((p) => !p.done && p.amount.gt(0)).length;

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <div className="flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">تشغيل الإهلاك الدوري</h1>
          <p className="mt-1 text-sm text-muted-foreground">فترة {period.periodName} — {dueCount} أصل مستحق</p>
        </div>
        <Link href="/accounting/fixed-assets" className="text-sm text-primary hover:underline">
          كل الأصول الثابتة ←
        </Link>
      </div>

      {periods.length > 1 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {periods.map((p) => (
            <Link
              key={p.id}
              href={`/accounting/depreciation?period=${p.id}`}
              className={`rounded-lg border px-3 py-1.5 text-sm ${
                p.id === period.id ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-secondary"
              }`}
            >
              {p.periodName}
            </Link>
          ))}
        </div>
      )}

      <div className="mt-6">
        <RunDepreciationButton periodId={period.id} />
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>الكود</TableHead>
              <TableHead>الاسم</TableHead>
              <TableHead>القيمة الدفترية الحالية</TableHead>
              <TableHead>القسط المحسوب</TableHead>
              <TableHead>الحالة</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {preview.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-6 text-center text-muted-foreground">
                  مفيش أصول ثابتة نشطة.
                </TableCell>
              </TableRow>
            ) : (
              preview.map(({ asset, done, amount }) => (
                <TableRow key={asset.id}>
                  <TableCell className="font-mono text-foreground/80">{asset.assetCode}</TableCell>
                  <TableCell className="text-foreground">{asset.nameAr}</TableCell>
                  <TableCell className="font-mono text-foreground/80">{asset.netBookValue.toFixed(2)}</TableCell>
                  <TableCell className="font-mono text-foreground">{done ? "—" : amount.toFixed(2)}</TableCell>
                  <TableCell className={done ? "text-emerald-700" : amount.isZero() ? "text-muted-foreground" : "text-amber-700"}>
                    {done ? "اترحّل بالفعل" : amount.isZero() ? "اكتمل إهلاكه" : "مستحق"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        التشغيل بيرحّل قيد واحد مجمّع لكل الأصول المستحقة — الأصول اللي اترحّل لها إهلاك الفترة دي بالفعل بتتخطّى تلقائيًا.
      </p>
    </main>
  );
}
