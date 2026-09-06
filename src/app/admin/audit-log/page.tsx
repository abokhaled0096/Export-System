import Link from "next/link";
import { requireCurrentUser } from "@/lib/session";
import { requirePermission } from "@/lib/permissions";
import { getScopedPrisma } from "@/lib/scoped-prisma";
import { getCurrentOrgId } from "@/lib/org";
import { PAGE_SIZE, parsePage } from "@/lib/pagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

const ALL = "__all__";

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; entityType?: string; userId?: string }>;
}) {
  const user = await requireCurrentUser();

  try {
    await requirePermission(user.roleId, "AuditLog", "View");
  } catch {
    return (
      <main className="mx-auto max-w-3xl px-6 py-10">
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-6 text-center text-sm text-destructive">
          معندكش صلاحية الوصول للصفحة دي — سجل التدقيق متاح لـAdmin/CompanyOwner بس.
        </div>
      </main>
    );
  }

  const { entityType, userId } = await searchParams;
  const page = parsePage((await searchParams).page);
  const orgId = await getCurrentOrgId();
  const prisma = await getScopedPrisma();

  const where = {
    orgId,
    ...(entityType && entityType !== ALL ? { entityType } : {}),
    ...(userId && userId !== ALL ? { userId } : {}),
  };

  // ⚠️ مش Promise.all — راجع BACKLOG.md (P2028).
  const entries = await prisma.auditLog.findMany({
    where,
    include: { user: true },
    orderBy: { occurredAt: "desc" },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });
  const total = await prisma.auditLog.count({ where });
  const entityTypes = await prisma.auditLog.findMany({
    where: { orgId },
    distinct: ["entityType"],
    select: { entityType: true },
    orderBy: { entityType: "asc" },
  });
  const users = await prisma.user.findMany({ where: { orgId }, orderBy: { fullName: "asc" } });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const queryWith = (overrides: Record<string, string | number>) => {
    const params = new URLSearchParams();
    if (entityType && entityType !== ALL) params.set("entityType", entityType);
    if (userId && userId !== ALL) params.set("userId", userId);
    params.set("page", String(page));
    for (const [k, v] of Object.entries(overrides)) {
      if (v === ALL || v === "") params.delete(k);
      else params.set(k, String(v));
    }
    return `?${params.toString()}`;
  };

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">سجل التدقيق</h1>
          <p className="mt-1 text-sm text-muted-foreground">{total} حركة مسجّلة — سجل Insert-only، مفيش تعديل أو حذف.</p>
        </div>
        <Button
          nativeButton={false}
          variant="outline"
          render={
            <a href={`/admin/audit-log/export?${new URLSearchParams({ ...(entityType ? { entityType } : {}), ...(userId ? { userId } : {}) }).toString()}`}>
              تصدير CSV
            </a>
          }
        />
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <span className="text-xs text-muted-foreground self-center">الكيان:</span>
        <Button nativeButton={false} variant={!entityType || entityType === ALL ? "secondary" : "ghost"} size="sm" render={<Link href={queryWith({ entityType: ALL, page: 1 })} />}>
          الكل
        </Button>
        {entityTypes.map((e) => (
          <Button
            key={e.entityType}
            nativeButton={false}
            variant={entityType === e.entityType ? "secondary" : "ghost"}
            size="sm"
            render={<Link href={queryWith({ entityType: e.entityType, page: 1 })} />}
          >
            {e.entityType}
          </Button>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <span className="text-xs text-muted-foreground self-center">المستخدم:</span>
        <Button nativeButton={false} variant={!userId || userId === ALL ? "secondary" : "ghost"} size="sm" render={<Link href={queryWith({ userId: ALL, page: 1 })} />}>
          الكل
        </Button>
        {users.map((u) => (
          <Button
            key={u.id}
            nativeButton={false}
            variant={userId === u.id ? "secondary" : "ghost"}
            size="sm"
            render={<Link href={queryWith({ userId: u.id, page: 1 })} />}
          >
            {u.fullName}
          </Button>
        ))}
      </div>

      {entries.length === 0 ? (
        <div className="mt-10 rounded-xl border border-dashed border-border py-16 text-center text-muted-foreground">
          <p>مفيش حركات مطابقة للفلتر ده.</p>
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>التاريخ والوقت</TableHead>
                <TableHead>المستخدم</TableHead>
                <TableHead>الفعل</TableHead>
                <TableHead>الكيان</TableHead>
                <TableHead>تفاصيل</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="whitespace-nowrap font-mono text-xs text-foreground/80">
                    {new Intl.DateTimeFormat("ar-EG", { dateStyle: "medium", timeStyle: "short" }).format(e.occurredAt)}
                  </TableCell>
                  <TableCell>{e.user?.fullName ?? "نظام"}</TableCell>
                  <TableCell className="font-mono text-xs">{e.action}</TableCell>
                  <TableCell className="font-mono text-xs text-foreground/70">
                    {e.entityType} <span className="text-muted-foreground/60">({e.entityId.slice(0, 8)})</span>
                  </TableCell>
                  <TableCell>
                    {(e.beforeValue || e.afterValue) && (
                      <details>
                        <summary className="cursor-pointer text-xs text-primary hover:underline">عرض</summary>
                        <div className="mt-2 flex flex-col gap-2 text-xs">
                          {e.beforeValue ? (
                            <pre className="max-w-xs overflow-x-auto rounded bg-muted p-2">
                              {JSON.stringify(e.beforeValue, null, 2)}
                            </pre>
                          ) : null}
                          {e.afterValue ? (
                            <pre className="max-w-xs overflow-x-auto rounded bg-muted p-2">
                              {JSON.stringify(e.afterValue, null, 2)}
                            </pre>
                          ) : null}
                        </div>
                      </details>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-3 text-sm">
          <Button nativeButton={false} variant="outline" size="sm" disabled={page <= 1} render={<Link href={queryWith({ page: Math.max(1, page - 1) })} />}>
            السابق
          </Button>
          <span className="text-muted-foreground">صفحة {page} من {totalPages}</span>
          <Button nativeButton={false} variant="outline" size="sm" disabled={page >= totalPages} render={<Link href={queryWith({ page: Math.min(totalPages, page + 1) })} />}>
            التالي
          </Button>
        </div>
      )}
    </main>
  );
}
