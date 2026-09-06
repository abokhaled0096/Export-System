import { NextResponse } from "next/server";
import { getScopedPrisma } from "@/lib/scoped-prisma";
import { requireCurrentUser } from "@/lib/session";
import { requirePermission } from "@/lib/permissions";
import { toCsv } from "@/lib/csv";

/** ⚠️ كانت بلا أي فحص صلاحية خالص (اتكشف في إعادة مراجعة وحدة 1، 7 سبتمبر) — نفس فئة
 * /products/export. */
export async function GET() {
  const user = await requireCurrentUser();
  try {
    await requirePermission(user.roleId, "Market", "View");
  } catch {
    return new NextResponse("معندكش صلاحية الوصول لهذه البيانات", { status: 403 });
  }

  const orgId = user.orgId;
  const prisma = await getScopedPrisma();

  const markets = await prisma.market.findMany({ where: { orgId, deletedAt: null }, orderBy: { createdAt: "desc" } });

  const csv = toCsv(markets, [
    { key: "countryNameAr", label: "اسم الدولة بالعربية" },
    { key: "countryNameEn", label: "Country Name (English)" },
    { key: "countryCode", label: "كود الدولة" },
    { key: "continent", label: "القارة" },
    { key: "currency", label: "العملة" },
    { key: "mainPorts", label: "الموانئ الرئيسية" },
  ]);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="markets-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
