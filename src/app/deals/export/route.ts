import { NextResponse } from "next/server";
import { getScopedPrisma } from "@/lib/scoped-prisma";
import { requireCurrentUser } from "@/lib/session";
import { getPermissionScope, scopedOwnerIdFilter } from "@/lib/permissions";
import { toCsv } from "@/lib/csv";

const statusLabel: Record<string, string> = {
  Draft: "مسودة",
  Pricing: "جاري التسعير",
  Negotiation: "تفاوض",
  Approved: "معتمدة",
  Won: "مكسوبة",
  Lost: "خسرانة",
  Cancelled: "ملغاة",
};

export async function GET(req: Request) {
  const user = await requireCurrentUser();
  const orgId = user.orgId;
  const prisma = await getScopedPrisma();
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? undefined;

  const scope = await getPermissionScope(user.roleId, "Deal", "View");
  const scopedOwnerId = await scopedOwnerIdFilter(scope, user);
  const dealOwnerFilter = scopedOwnerId !== undefined ? { opportunity: { ownerId: scopedOwnerId } } : {};
  const searchFilter = q
    ? {
        OR: [
          { customer: { legalName: { contains: q, mode: "insensitive" as const } } },
          { product: { nameAr: { contains: q, mode: "insensitive" as const } } },
        ],
      }
    : {};

  const deals = await prisma.deal.findMany({
    where: { orgId, deletedAt: null, ...dealOwnerFilter, ...searchFilter },
    include: { customer: true, product: true, market: true },
    orderBy: { createdAt: "desc" },
  });

  const rows = deals.map((d) => ({
    customer: d.customer.legalName,
    product: d.product.nameAr,
    market: d.market.countryNameAr,
    status: statusLabel[d.status] ?? d.status,
    objective: d.dealObjective,
  }));

  const csv = toCsv(rows, [
    { key: "customer", label: "العميل" },
    { key: "product", label: "المنتج" },
    { key: "market", label: "السوق" },
    { key: "status", label: "الحالة" },
    { key: "objective", label: "هدف الصفقة" },
  ]);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="deals-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
