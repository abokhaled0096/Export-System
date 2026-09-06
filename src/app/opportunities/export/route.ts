import { NextResponse } from "next/server";
import { getScopedPrisma } from "@/lib/scoped-prisma";
import { requireCurrentUser } from "@/lib/session";
import { getPermissionScope, ownerScopeWhere } from "@/lib/permissions";
import { toCsv } from "@/lib/csv";
import type { Prisma } from "@/generated/prisma/client";
import type { OpportunityStage } from "@/generated/prisma/enums";

const stages = ["NewLead", "Contacted", "Qualified", "QuoteSent", "Won", "Lost"];

export async function GET(req: Request) {
  const user = await requireCurrentUser();
  const orgId = user.orgId;
  const prisma = await getScopedPrisma();
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? undefined;
  const stage = searchParams.get("stage") ?? undefined;

  const scope = await getPermissionScope(user.roleId, "Opportunity", "View");
  const ownerFilter = await ownerScopeWhere(scope, user);

  const where: Prisma.OpportunityWhereInput = {
    orgId,
    deletedAt: null,
    ...ownerFilter,
    ...(q ? { company: { legalName: { contains: q, mode: "insensitive" } } } : {}),
    ...(stage && stages.includes(stage) ? { stage: stage as OpportunityStage } : {}),
  };

  const opportunities = await prisma.opportunity.findMany({
    where,
    include: { company: true, product: true, market: true },
    orderBy: { createdAt: "desc" },
  });

  const rows = opportunities.map((o) => ({
    company: o.company.legalName,
    product: o.product.nameAr,
    market: o.market.countryNameAr,
    stage: o.stage,
    expectedValue: o.expectedValue,
    currency: o.currency,
  }));

  const csv = toCsv(rows, [
    { key: "company", label: "الشركة" },
    { key: "product", label: "المنتج" },
    { key: "market", label: "السوق" },
    { key: "stage", label: "المرحلة" },
    { key: "expectedValue", label: "القيمة المتوقعة" },
    { key: "currency", label: "العملة" },
  ]);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="opportunities-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
