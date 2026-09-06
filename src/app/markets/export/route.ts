import { NextResponse } from "next/server";
import { getScopedPrisma } from "@/lib/scoped-prisma";
import { getCurrentOrgId } from "@/lib/org";
import { toCsv } from "@/lib/csv";

export async function GET() {
  const orgId = await getCurrentOrgId();
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
