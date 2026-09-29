import { requireCurrentUser } from "@/lib/session";
import { requirePermission } from "@/lib/permissions";
import { getScopedPrisma } from "@/lib/scoped-prisma";
import { getCurrentOrgId } from "@/lib/org";
import { PAGE_SIZE, parsePage } from "@/lib/pagination";
import Pagination from "@/components/Pagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const dynamic = "force-dynamic";

export default async function ErrorLogPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const user = await requireCurrentUser();

  try {
    await requirePermission(user.roleId, "AuditLog", "View");
  } catch {
    return (
      <main className="mx-auto max-w-3xl px-6 py-10">
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-6 text-center text-sm text-destructive">
          معندكش صلاحية الوصول للصفحة دي — سجل الأخطاء متاح لـAdmin/CompanyOwner بس.
        </div>
      </main>
    );
  }

  const page = parsePage((await searchParams).page);
  const orgId = await getCurrentOrgId();
  const prisma = await getScopedPrisma();

  // ⚠️ مش Promise.all — راجع BACKLOG.md (P2028).
  const entries = await prisma.errorLog.findMany({
    where: { orgId },
    include: { user: true },
    orderBy: { occurredAt: "desc" },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });
  const total = await prisma.errorLog.count({ where: { orgId } });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">سجل الأخطاء</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {total} خطأ مسجّل — استثناءات غير متوقعة اتبتلعت قبل كده بلا أثر، دلوقتي بتتسجّل هنا. راجع BACKLOG.md § متابعة الأخطاء.
        </p>
      </div>

      {entries.length === 0 ? (
        <div className="mt-10 rounded-xl border border-dashed border-border py-16 text-center text-muted-foreground">
          <p>مفيش أخطاء مسجّلة — حظ سعيد 🎉</p>
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>التاريخ والوقت</TableHead>
                <TableHead>المستخدم</TableHead>
                <TableHead>الفعل</TableHead>
                <TableHead>الرسالة</TableHead>
                <TableHead>التفاصيل</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="whitespace-nowrap font-mono text-xs text-foreground/80">
                    {new Intl.DateTimeFormat("ar-EG", { dateStyle: "medium", timeStyle: "short" }).format(e.occurredAt)}
                  </TableCell>
                  <TableCell>{e.user?.fullName ?? "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{e.action}</TableCell>
                  <TableCell className="max-w-sm text-xs text-destructive">{e.message}</TableCell>
                  <TableCell>
                    {e.stack && (
                      <details>
                        <summary className="cursor-pointer text-xs text-primary hover:underline">Stack trace</summary>
                        <pre className="mt-2 max-w-md overflow-x-auto rounded bg-muted p-2 text-xs">{e.stack}</pre>
                      </details>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <Pagination currentPage={page} totalPages={totalPages} basePath="/admin/errors" />
    </main>
  );
}
