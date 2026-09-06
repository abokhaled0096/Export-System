import { NextResponse } from "next/server";
import { getScopedPrisma } from "@/lib/scoped-prisma";
import { requireCurrentUser } from "@/lib/session";
import { getPermissionScope, ownerScopeWhere } from "@/lib/permissions";
import { toCsv } from "@/lib/csv";
import type { Prisma } from "@/generated/prisma/client";
import type { CompanyStatus } from "@/generated/prisma/enums";

const statuses = [
  "Lead",
  "Suspect",
  "Prospect",
  "Qualified",
  "ActiveOpportunity",
  "Customer",
  "RepeatCustomer",
  "StrategicAccount",
  "Dormant",
  "Rejected",
  "Blacklisted",
];

export async function GET(req: Request) {
  const user = await requireCurrentUser();
  const orgId = user.orgId;
  const prisma = await getScopedPrisma();
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? undefined;
  const status = searchParams.get("status") ?? undefined;

  const scope = await getPermissionScope(user.roleId, "Company", "View");
  const ownerFilter = await ownerScopeWhere(scope, user);

  const where: Prisma.CompanyWhereInput = {
    orgId,
    deletedAt: null,
    ...ownerFilter,
    ...(q
      ? {
          OR: [
            { legalName: { contains: q, mode: "insensitive" } },
            { tradeName: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(status && statuses.includes(status) ? { status: status as CompanyStatus } : {}),
  };

  const companies = await prisma.company.findMany({ where, orderBy: { createdAt: "desc" } });

  const csv = toCsv(companies, [
    { key: "legalName", label: "الاسم القانوني" },
    { key: "tradeName", label: "الاسم التجاري" },
    { key: "country", label: "الدولة" },
    { key: "city", label: "المدينة" },
    { key: "classification", label: "التصنيف" },
    { key: "status", label: "الحالة" },
  ]);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="companies-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
