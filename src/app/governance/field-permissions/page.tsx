import { requireCurrentUser } from "@/lib/session";
import { requirePermission } from "@/lib/permissions";
import { getScopedPrisma } from "@/lib/scoped-prisma";
import FieldPermissionForm from "./FieldPermissionForm";
import DeleteFieldPermissionButton from "./DeleteFieldPermissionButton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PAGE_SIZE, parsePage } from "@/lib/pagination";
import Pagination from "@/components/Pagination";

export const dynamic = "force-dynamic";

const ACCESS_LEVEL_LABEL: Record<string, string> = {
  Hidden: "مخفي",
  ReadOnly: "عرض بس",
  ReadWrite: "عرض وتعديل",
};

export default async function FieldPermissionsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const page = parsePage((await searchParams).page);
  const user = await requireCurrentUser();

  try {
    await requirePermission(user.roleId, "FieldPermission", "View");
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
  // ⚠️ مش Promise.all — راجع BACKLOG.md (P2028: كل استعلام من getScopedPrisma() بيفتح
  // transaction لوحده، والتنفيذ بالتوازي بيتزاحم على اتصال الـpool).
  const fieldPermissionWhere = { role: { orgId: user.orgId } };
  const fieldPermissions = await prisma.fieldPermission.findMany({
    where: fieldPermissionWhere,
    include: { role: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });
  const total = await prisma.fieldPermission.count({ where: fieldPermissionWhere });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const roles = await prisma.role.findMany({ where: { orgId: user.orgId }, orderBy: { name: "asc" }, select: { id: true, name: true } });

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">صلاحيات الحقول</h1>
        <p className="mt-1 text-sm text-muted-foreground">{total} صلاحية مسجّلة</p>
      </div>

      <div className="mt-6">
        <FieldPermissionForm roles={roles} />
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>الدور</TableHead>
              <TableHead>الكيان</TableHead>
              <TableHead>الحقل</TableHead>
              <TableHead>مستوى الوصول</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {fieldPermissions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-6 text-center text-muted-foreground">
                  لسه مفيش صلاحيات حقول مسجّلة.
                </TableCell>
              </TableRow>
            ) : (
              fieldPermissions.map((fp) => (
                <TableRow key={fp.id}>
                  <TableCell className="text-foreground">{fp.role.name}</TableCell>
                  <TableCell className="font-mono text-foreground/80">{fp.entityType}</TableCell>
                  <TableCell className="font-mono text-foreground/80">{fp.fieldName}</TableCell>
                  <TableCell className="text-foreground/80">{ACCESS_LEVEL_LABEL[fp.accessLevel] ?? fp.accessLevel}</TableCell>
                  <TableCell>
                    <DeleteFieldPermissionButton fieldPermissionId={fp.id} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <Pagination currentPage={page} totalPages={totalPages} basePath="/governance/field-permissions" />
      <p className="mt-3 text-xs text-muted-foreground">
        أول استخدام حقيقي: إخفاء الحد الأدنى/نقطة التعادل/الربح عن مندوبي المبيعات في صفحات الصفقة (DealScenario.walkAwayPrice وما شابه) — راجع STATUS.md.
      </p>
    </main>
  );
}
