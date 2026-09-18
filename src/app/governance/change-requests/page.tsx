import Link from "next/link";
import { requireCurrentUser } from "@/lib/session";
import { requirePermission } from "@/lib/permissions";
import { getScopedPrisma } from "@/lib/scoped-prisma";
import ChangeRequestForm from "./ChangeRequestForm";
import DecisionButtons from "./DecisionButtons";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ENTITY_LINK_BASE, entityTypeLabel } from "@/lib/changeRequestLabels";
import { PAGE_SIZE, parsePage } from "@/lib/pagination";
import Pagination from "@/components/Pagination";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = { Pending: "قيد المراجعة", Approved: "معتمَد", Rejected: "مرفوض" };
const STATUS_STYLE: Record<string, string> = {
  Pending: "bg-amber-100 text-amber-700 hover:bg-amber-100",
  Approved: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  Rejected: "bg-rose-100 text-rose-700 hover:bg-rose-100",
};

export default async function ChangeRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const user = await requireCurrentUser();
  const page = parsePage((await searchParams).page);

  try {
    await requirePermission(user.roleId, "MasterDataChangeRequest", "View");
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

  let canDecide = true;
  try {
    await requirePermission(user.roleId, "MasterDataChangeRequest", "Edit");
  } catch {
    canDecide = false;
  }

  const changeRequestWhere = { orgId };
  const requests = await prisma.masterDataChangeRequest.findMany({
    where: changeRequestWhere,
    orderBy: { createdAt: "desc" },
    include: { requestedByUser: { select: { fullName: true } }, approvedByUser: { select: { fullName: true } } },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });
  const total = await prisma.masterDataChangeRequest.count({ where: changeRequestWhere });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">طلبات تعديل البيانات الأساسية</h1>
        <p className="mt-1 text-sm text-muted-foreground">{total} طلب</p>
      </div>

      <div className="mt-6">
        <ChangeRequestForm />
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>الكيان</TableHead>
              <TableHead>المعرّف</TableHead>
              <TableHead>التغييرات المقترحة</TableHead>
              <TableHead>مقدَّم بمعرفة</TableHead>
              <TableHead>الحالة</TableHead>
              <TableHead>قرار بمعرفة</TableHead>
              {canDecide && <TableHead />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {requests.length === 0 ? (
              <TableRow>
                <TableCell colSpan={canDecide ? 7 : 6} className="py-6 text-center text-muted-foreground">
                  لسه مفيش طلبات مسجّلة.
                </TableCell>
              </TableRow>
            ) : (
              requests.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-foreground/80">{entityTypeLabel[r.entityType] ?? r.entityType}</TableCell>
                  <TableCell className="font-mono text-xs text-foreground/60">
                    {r.entityId === "NEW" ? (
                      <span className="rounded bg-sky-100 px-1.5 py-0.5 font-sans text-xs text-sky-700">طلب إنشاء جديد</span>
                    ) : r.status === "Approved" && ENTITY_LINK_BASE[r.entityType] ? (
                      <Link href={`${ENTITY_LINK_BASE[r.entityType]}/${r.entityId}`} className="text-primary hover:underline">
                        {r.entityId.slice(0, 8)}
                      </Link>
                    ) : (
                      r.entityId
                    )}
                  </TableCell>
                  <TableCell className="max-w-xs truncate font-mono text-xs text-foreground/80">{JSON.stringify(r.proposedChanges)}</TableCell>
                  <TableCell className="text-foreground/80">{r.requestedByUser.fullName}</TableCell>
                  <TableCell>
                    <Badge className={STATUS_STYLE[r.status]}>{STATUS_LABEL[r.status]}</Badge>
                  </TableCell>
                  <TableCell className="text-foreground/80">{r.approvedByUser?.fullName ?? "—"}</TableCell>
                  {canDecide && <TableCell>{r.status === "Pending" && <DecisionButtons requestId={r.id} />}</TableCell>}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <Pagination currentPage={page} totalPages={totalPages} basePath="/governance/change-requests" />
    </main>
  );
}
