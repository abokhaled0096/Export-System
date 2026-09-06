import Link from "next/link";
import { requireCurrentUser } from "@/lib/session";
import { requirePermission } from "@/lib/permissions";
import { getScopedPrisma } from "@/lib/scoped-prisma";
import { getCurrentOrgId } from "@/lib/org";
import { PAGE_SIZE, parsePage } from "@/lib/pagination";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

type ImportSummary = { created: number; autoMatched: number; skippedAsDuplicate: number };

function isImportSummary(v: unknown): v is ImportSummary {
  return (
    typeof v === "object" &&
    v !== null &&
    typeof (v as Record<string, unknown>).created === "number" &&
    typeof (v as Record<string, unknown>).autoMatched === "number" &&
    typeof (v as Record<string, unknown>).skippedAsDuplicate === "number"
  );
}

/** سجل الاستيرادات — أثر كل عملية "استيراد كشف حساب CSV" (`bankTransaction.csvImported` في
 * AuditLog، سطر واحد لكل عملية استيراد — مش سطر لكل حركة، دي مسؤولية `/admin/audit-log`).
 * صفحة مستقلة عن سجل التدقيق العام لأنها متاحة لمين عنده `BankTransaction.View` (Finance)،
 * مش Admin/CompanyOwner بس زي `/admin/audit-log`. */
export default async function BankImportsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const user = await requireCurrentUser();

  try {
    await requirePermission(user.roleId, "BankTransaction", "View");
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

  // entityType محدَّد صراحةً — الفعل نفسه مربوط بـBankAccount دلوقتي، لكن ده مايفترضش يفضل
  // كده للأبد؛ فلترة entityType هنا دفاع رخيص ضد أي إعادة استخدام مستقبلية لاسم الفعل ده.
  const where = { orgId, action: "bankTransaction.csvImported", entityType: "BankAccount" };
  const total = await prisma.auditLog.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  // لو المستخدم طلب صفحة بعد آخر صفحة فعليًا (رابط قديم أو تعديل يدوي في الـURL)، تتعامل زي
  // آخر صفحة صحيحة بدل ما تظهر "مفيش عمليات استيراد" وهي فعليًا موجودة في صفحات قبلها.
  const page = Math.min(parsePage((await searchParams).page), totalPages);

  const entries = await prisma.auditLog.findMany({
    where,
    include: { user: true },
    orderBy: { occurredAt: "desc" },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });

  const accounts = entries.length
    ? await prisma.bankAccount.findMany({
        where: { id: { in: [...new Set(entries.map((e) => e.entityId))] } },
        select: { id: true, accountName: true, bankName: true },
      })
    : [];
  const accountById = new Map(accounts.map((a) => [a.id, a]));

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <Link href="/accounting/bank-accounts" className="text-sm text-muted-foreground hover:underline">
        → كل الحسابات البنكية
      </Link>

      <div className="mt-3">
        <h1 className="text-2xl font-semibold text-foreground">سجل استيراد كشوف الحساب</h1>
        <p className="mt-1 text-sm text-muted-foreground">{total} عملية استيراد CSV مسجّلة عبر كل الحسابات البنكية.</p>
      </div>

      {entries.length === 0 ? (
        <div className="mt-10 rounded-xl border border-dashed border-border py-16 text-center text-muted-foreground">
          <p>لسه مفيش عمليات استيراد مسجّلة.</p>
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>التاريخ والوقت</TableHead>
                <TableHead>المستخدم</TableHead>
                <TableHead>الحساب البنكي</TableHead>
                <TableHead>اتسجّل</TableHead>
                <TableHead>مضاهى تلقائيًا</TableHead>
                <TableHead>اتجاهل (مكرر)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((e) => {
                const account = accountById.get(e.entityId);
                const summary = isImportSummary(e.afterValue) ? e.afterValue : null;
                return (
                  <TableRow key={e.id}>
                    <TableCell className="whitespace-nowrap font-mono text-xs text-foreground/80">
                      {new Intl.DateTimeFormat("ar-EG", { dateStyle: "medium", timeStyle: "short" }).format(e.occurredAt)}
                    </TableCell>
                    <TableCell className="text-foreground/80">{e.user?.fullName ?? "—"}</TableCell>
                    <TableCell>
                      {account ? (
                        <Link href={`/accounting/bank-accounts/${account.id}`} className="text-primary hover:underline">
                          {account.accountName} <span className="text-xs text-muted-foreground">({account.bankName})</span>
                        </Link>
                      ) : (
                        <span className="text-xs text-muted-foreground">حساب محذوف</span>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-foreground">{summary?.created ?? "—"}</TableCell>
                    <TableCell className="font-mono text-emerald-700">{summary?.autoMatched ?? "—"}</TableCell>
                    <TableCell className="font-mono text-muted-foreground">{summary?.skippedAsDuplicate ?? "—"}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-3 text-sm">
          <Button nativeButton={false} variant="outline" size="sm" disabled={page <= 1} render={<Link href={`?page=${Math.max(1, page - 1)}`} />}>
            السابق
          </Button>
          <span className="text-muted-foreground">
            صفحة {page} من {totalPages}
          </span>
          <Button
            nativeButton={false}
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            render={<Link href={`?page=${Math.min(totalPages, page + 1)}`} />}
          >
            التالي
          </Button>
        </div>
      )}
    </main>
  );
}
