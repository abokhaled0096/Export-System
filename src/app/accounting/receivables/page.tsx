import Link from "next/link";
import { Prisma } from "@/generated/prisma/client";
import { requireCurrentUser } from "@/lib/session";
import { requirePermission } from "@/lib/permissions";
import { getScopedPrisma } from "@/lib/scoped-prisma";
import { daysOverdue } from "@/lib/arapLabels";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PAGE_SIZE, parsePage } from "@/lib/pagination";
import Pagination from "@/components/Pagination";

export const dynamic = "force-dynamic";

/** شرائح أعمار الديون. الحد الأعلى `null` = المفتوحة (+90). */
const BUCKETS = [
  { key: "current", label: "جارية", max: 0, style: "text-emerald-700" },
  { key: "b1", label: "1–30 يوم", max: 30, style: "text-foreground" },
  { key: "b2", label: "31–60 يوم", max: 60, style: "text-amber-700" },
  { key: "b3", label: "61–90 يوم", max: 90, style: "text-orange-700" },
  { key: "b4", label: "أكتر من 90 يوم", max: null, style: "text-rose-700 font-semibold" },
] as const;

type BucketKey = (typeof BUCKETS)[number]["key"];

function bucketFor(dueDate: Date): BucketKey {
  const days = daysOverdue(dueDate);
  if (days === 0) return "current";
  if (days <= 30) return "b1";
  if (days <= 60) return "b2";
  if (days <= 90) return "b3";
  return "b4";
}

function emptyBuckets(): Record<BucketKey, Prisma.Decimal> {
  return { current: new Prisma.Decimal(0), b1: new Prisma.Decimal(0), b2: new Prisma.Decimal(0), b3: new Prisma.Decimal(0), b4: new Prisma.Decimal(0) };
}

export default async function ReceivablesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const user = await requireCurrentUser();

  try {
    await requirePermission(user.roleId, "Invoice", "View");
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
  const page = parsePage((await searchParams).page);
  // المتبقي = totalAmount − amountPaid، و`amountPaid` عمود مصان بـTrigger من الدفعات المحصّلة بس،
  // فالتقرير ده مبني على رقم مضمون مش على تجميعة لحظية ممكن تنحرف.
  const invoices = await prisma.invoice.findMany({
    where: {
      orgId: user.orgId,
      invoiceType: "SalesInvoice",
      status: { in: ["Issued", "PartiallyPaid"] },
    },
    orderBy: { dueDate: "asc" },
    include: { company: { select: { id: true, legalName: true } } },
  });

  const byCustomer = new Map<string, { name: string; buckets: Record<BucketKey, Prisma.Decimal>; total: Prisma.Decimal }>();
  const grand = emptyBuckets();
  let grandTotal = new Prisma.Decimal(0);

  for (const inv of invoices) {
    const remaining = inv.totalAmount.sub(inv.amountPaid);
    if (remaining.lte(0)) continue;

    const key = inv.company?.id ?? "unknown";
    let row = byCustomer.get(key);
    if (!row) {
      row = { name: inv.company?.legalName ?? "بدون عميل محدَّد", buckets: emptyBuckets(), total: new Prisma.Decimal(0) };
      byCustomer.set(key, row);
    }
    const b = bucketFor(inv.dueDate);
    row.buckets[b] = row.buckets[b].add(remaining);
    row.total = row.total.add(remaining);
    grand[b] = grand[b].add(remaining);
    grandTotal = grandTotal.add(remaining);
  }

  const rows = [...byCustomer.values()].sort((a, b) => b.total.comparedTo(a.total));
  const overdueTotal = grandTotal.sub(grand.current);

  // الترقيم هنا على صفوف العملاء المُجمَّعة (rows) مش على استعلام الفواتير نفسه —
  // لازم كل فواتير العميل المفتوحة تتحسب مع بعض عشان أرقام الشرائح والإجمالي تبقى صحيحة،
  // فمينفعش نعمل skip/take على invoices.findMany من غير ما نكسر التجميع.
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const pagedRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">أعمار الذمم المدينة</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {invoices.length} فاتورة مبيعات مفتوحة — المتبقي محسوب بعد الدفعات المحصّلة
          </p>
        </div>
        <Link href="/accounting/invoices" className="text-sm text-primary hover:underline">
          كل الفواتير ←
        </Link>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-xs text-muted-foreground">إجمالي المستحق</p>
          <p className="mt-1 font-mono text-2xl font-semibold text-foreground">{grandTotal.toFixed(2)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-xs text-muted-foreground">جارية (لسه مستحقتش)</p>
          <p className="mt-1 font-mono text-2xl font-semibold text-emerald-700">{grand.current.toFixed(2)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-xs text-muted-foreground">متأخرة</p>
          <p className="mt-1 font-mono text-2xl font-semibold text-rose-700">{overdueTotal.toFixed(2)}</p>
        </div>
      </div>

      <div className="mt-6 overflow-x-auto rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>العميل</TableHead>
              {BUCKETS.map((b) => (
                <TableHead key={b.key}>{b.label}</TableHead>
              ))}
              <TableHead>الإجمالي</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={BUCKETS.length + 2} className="py-6 text-center text-muted-foreground">
                  مفيش ذمم مدينة مفتوحة — كل الفواتير محصّلة. 🎉
                </TableCell>
              </TableRow>
            ) : (
              <>
                {pagedRows.map((r) => (
                  <TableRow key={r.name}>
                    <TableCell className="text-foreground">{r.name}</TableCell>
                    {BUCKETS.map((b) => (
                      <TableCell key={b.key} className={`font-mono ${r.buckets[b.key].isZero() ? "text-muted-foreground" : b.style}`}>
                        {r.buckets[b.key].toFixed(2)}
                      </TableCell>
                    ))}
                    <TableCell className="font-mono font-semibold text-foreground">{r.total.toFixed(2)}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="border-t-2 border-border">
                  <TableCell className="font-semibold text-foreground">الإجمالي</TableCell>
                  {BUCKETS.map((b) => (
                    <TableCell key={b.key} className={`font-mono font-semibold ${b.style}`}>
                      {grand[b.key].toFixed(2)}
                    </TableCell>
                  ))}
                  <TableCell className="font-mono text-lg font-semibold text-foreground">{grandTotal.toFixed(2)}</TableCell>
                </TableRow>
              </>
            )}
          </TableBody>
        </Table>
      </div>
      <Pagination currentPage={page} totalPages={totalPages} basePath="/accounting/receivables" extraParams={{}} />

      <p className="mt-3 text-xs text-muted-foreground">
        الشرائح محسوبة من تاريخ الاستحقاق وقت العرض — مفيش حالة &quot;متأخرة&quot; مخزَّنة في القاعدة عشان متبقاش قديمة.
      </p>
    </main>
  );
}
