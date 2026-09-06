import { NextResponse } from "next/server";
import { getScopedPrisma } from "@/lib/scoped-prisma";
import { requireCurrentUser } from "@/lib/session";
import { requirePermission } from "@/lib/permissions";
import { toCsv } from "@/lib/csv";

const ALL = "__all__";
/** سقف تصدير — سجل التدقيق ممكن يكبر بسرعة، ومفيش pagination في التصدير نفسه. */
const MAX_EXPORT_ROWS = 5000;

export async function GET(req: Request) {
  const user = await requireCurrentUser();
  try {
    await requirePermission(user.roleId, "AuditLog", "View");
  } catch {
    return new NextResponse("معندكش صلاحية تصدير سجل التدقيق", { status: 403 });
  }

  const orgId = user.orgId;
  const prisma = await getScopedPrisma();
  const { searchParams } = new URL(req.url);
  const entityType = searchParams.get("entityType") ?? undefined;
  const userId = searchParams.get("userId") ?? undefined;

  const where = {
    orgId,
    ...(entityType && entityType !== ALL ? { entityType } : {}),
    ...(userId && userId !== ALL ? { userId } : {}),
  };

  const entries = await prisma.auditLog.findMany({
    where,
    include: { user: true },
    orderBy: { occurredAt: "desc" },
    take: MAX_EXPORT_ROWS,
  });

  const rows = entries.map((e) => ({
    occurredAt: e.occurredAt.toISOString(),
    user: e.user?.fullName ?? "نظام",
    action: e.action,
    entityType: e.entityType,
    entityId: e.entityId,
    beforeValue: e.beforeValue ? JSON.stringify(e.beforeValue) : "",
    afterValue: e.afterValue ? JSON.stringify(e.afterValue) : "",
  }));

  const csv = toCsv(rows, [
    { key: "occurredAt", label: "التاريخ والوقت" },
    { key: "user", label: "المستخدم" },
    { key: "action", label: "الفعل" },
    { key: "entityType", label: "الكيان" },
    { key: "entityId", label: "معرّف الكيان" },
    { key: "beforeValue", label: "قبل" },
    { key: "afterValue", label: "بعد" },
  ]);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="audit-log-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
