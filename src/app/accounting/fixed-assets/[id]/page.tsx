import Link from "next/link";
import { notFound } from "next/navigation";
import { Prisma } from "@/generated/prisma/client";
import { requireCurrentUser } from "@/lib/session";
import { requirePermission } from "@/lib/permissions";
import { getScopedPrisma } from "@/lib/scoped-prisma";
import DisposalForm from "./DisposalForm";
import FixedAssetEditForm from "./FixedAssetEditForm";
import { fixedAssetCategoryLabel, fixedAssetStatusLabel, fixedAssetStatusStyle, depreciationMethodLabel } from "@/lib/treasuryLabels";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function FixedAssetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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

  const prisma = await getScopedPrisma();
  const asset = await prisma.fixedAsset.findFirst({
    where: { id, orgId: user.orgId },
    include: {
      costCenter: { select: { name: true } },
      disposalJournalEntry: { select: { id: true, entryNumber: true } },
      depreciationEntries: {
        orderBy: { period: "asc" },
        include: { journalEntry: { select: { id: true, entryNumber: true } } },
      },
    },
  });
  if (!asset) notFound();

  const costCenters = await prisma.costCenter.findMany({ where: { orgId: user.orgId }, orderBy: { code: "asc" }, select: { id: true, code: true, name: true } });
  const org = await prisma.organization.findUniqueOrThrow({ where: { id: user.orgId }, select: { functionalCurrency: true } });
  const needsFxRate = !!org.functionalCurrency && asset.currency !== org.functionalCurrency;

  const scheduleRows = asset.depreciationEntries.reduce<Array<{ entry: (typeof asset.depreciationEntries)[number]; cumulative: Prisma.Decimal }>>(
    (acc, entry) => {
      const previous = acc.length > 0 ? acc[acc.length - 1].cumulative : new Prisma.Decimal(0);
      acc.push({ entry, cumulative: previous.add(entry.amount) });
      return acc;
    },
    []
  );

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <Link href="/accounting/fixed-assets" className="text-sm text-muted-foreground hover:underline">
        → كل الأصول الثابتة
      </Link>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <h1 className="font-mono text-2xl font-semibold text-foreground">{asset.assetCode}</h1>
        <span className="text-lg text-foreground">{asset.nameAr}</span>
        <Badge className={fixedAssetStatusStyle[asset.status]}>{fixedAssetStatusLabel[asset.status]}</Badge>
      </div>

      <div className="mt-3">
        <FixedAssetEditForm assetId={asset.id} nameAr={asset.nameAr} nameEn={asset.nameEn} costCenterId={asset.costCenterId} costCenters={costCenters} />
      </div>

      <dl className="mt-6 grid gap-4 rounded-xl border border-border bg-card p-5 sm:grid-cols-3">
        <div>
          <dt className="text-xs text-muted-foreground">الفئة</dt>
          <dd className="text-foreground">{fixedAssetCategoryLabel[asset.category]}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">مركز التكلفة</dt>
          <dd className="text-foreground">{asset.costCenter?.name ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">طريقة الإهلاك</dt>
          <dd className="text-foreground">{depreciationMethodLabel[asset.depreciationMethod]}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">قيمة الشراء</dt>
          <dd className="font-mono text-foreground">
            {asset.purchaseValue.toFixed(2)} {asset.currency}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">العمر الإنتاجي</dt>
          <dd className="text-foreground">{asset.usefulLifeMonths} شهر</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">تاريخ الشراء</dt>
          <dd className="text-foreground">{formatDate(asset.purchaseDate)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">مجمّع الإهلاك</dt>
          <dd className="font-mono text-foreground">{asset.accumulatedDepreciation.toFixed(2)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">القيمة الدفترية الصافية</dt>
          <dd className="font-mono text-lg font-semibold text-foreground">{asset.netBookValue.toFixed(2)}</dd>
        </div>
        {asset.status === "Disposed" && (
          <>
            <div>
              <dt className="text-xs text-muted-foreground">تاريخ التخلص</dt>
              <dd className="text-foreground">{formatDate(asset.disposalDate)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">حصيلة البيع</dt>
              <dd className="font-mono text-foreground">{asset.disposalValue?.toFixed(2)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">قيد التخلص</dt>
              <dd className="text-foreground">
                {asset.disposalJournalEntry && (
                  <Link href={`/accounting/journal-entries/${asset.disposalJournalEntry.id}`} className="font-mono text-primary hover:underline">
                    {asset.disposalJournalEntry.entryNumber}
                  </Link>
                )}
              </dd>
            </div>
          </>
        )}
      </dl>

      {asset.status === "Active" && (
        <div className="mt-5">
          <DisposalForm
            assetId={asset.id}
            netBookValue={asset.netBookValue.toFixed(2)}
            currency={asset.currency}
            needsFxRate={needsFxRate}
            functionalCurrency={org.functionalCurrency ?? undefined}
          />
        </div>
      )}

      <h2 className="mt-8 text-lg font-semibold text-foreground">جدول الإهلاك التراكمي</h2>
      <div className="mt-2 overflow-x-auto rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>الفترة</TableHead>
              <TableHead>مبلغ الإهلاك</TableHead>
              <TableHead>مجمّع الإهلاك التراكمي</TableHead>
              <TableHead>القيد المحاسبي</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {scheduleRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-6 text-center text-muted-foreground">
                  لسه مفيش إهلاك مرحّل على الأصل ده — شغّله من صفحة الإهلاك الدوري.
                </TableCell>
              </TableRow>
            ) : (
              scheduleRows.map(({ entry, cumulative }) => (
                <TableRow key={entry.id}>
                  <TableCell className="text-foreground/80">{entry.period}</TableCell>
                  <TableCell className="font-mono text-foreground">{entry.amount.toFixed(2)}</TableCell>
                  <TableCell className="font-mono text-foreground/80">{cumulative.toFixed(2)}</TableCell>
                  <TableCell>
                    <Link href={`/accounting/journal-entries/${entry.journalEntry.id}`} className="font-mono text-xs text-primary hover:underline">
                      {entry.journalEntry.entryNumber}
                    </Link>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </main>
  );
}
