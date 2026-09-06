import { NextResponse } from "next/server";
import { getScopedPrisma } from "@/lib/scoped-prisma";
import { getCurrentOrgId } from "@/lib/org";
import { toCsv } from "@/lib/csv";
import type { Prisma } from "@/generated/prisma/client";
import type { ProductStatus } from "@/generated/prisma/enums";

const statuses = ["Draft", "Verified", "NeedsReview"];

export async function GET(req: Request) {
  const orgId = await getCurrentOrgId();
  const prisma = await getScopedPrisma();
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? undefined;
  const status = searchParams.get("status") ?? undefined;

  const where: Prisma.ProductWhereInput = {
    orgId,
    deletedAt: null,
    ...(q
      ? {
          OR: [
            { nameAr: { contains: q, mode: "insensitive" } },
            { nameEn: { contains: q, mode: "insensitive" } },
            { hsCode: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(status && statuses.includes(status) ? { status: status as ProductStatus } : {}),
  };

  const products = await prisma.product.findMany({ where, orderBy: { createdAt: "desc" } });

  const csv = toCsv(products, [
    { key: "nameAr", label: "الاسم بالعربية" },
    { key: "nameEn", label: "Name (English)" },
    { key: "hsCode", label: "HS Code" },
    { key: "category", label: "الفئة" },
    { key: "originCountry", label: "بلد المنشأ" },
    { key: "harvestSeason", label: "موسم الحصاد" },
    { key: "shelfLifeDays", label: "مدة الصلاحية (يوم)" },
    { key: "requiresRefrigeration", label: "يحتاج تبريد" },
    { key: "status", label: "الحالة" },
  ]);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="products-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
