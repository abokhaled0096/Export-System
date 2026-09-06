import { NextResponse } from "next/server";
import { getScopedPrisma } from "@/lib/scoped-prisma";
import { requireCurrentUser } from "@/lib/session";
import { requirePermission } from "@/lib/permissions";
import { toCsv } from "@/lib/csv";
import type { Prisma } from "@/generated/prisma/client";
import type { ProductStatus } from "@/generated/prisma/enums";

const statuses = ["Draft", "Verified", "NeedsReview"];

/** ⚠️ كانت بلا أي فحص صلاحية خالص — أخطر من عرض سجل واحد لأنها بتصدّر كل المنتجات دفعة واحدة
 * (اتكشف في إعادة مراجعة وحدة 1، 7 سبتمبر، بعد ما نفس الفئة اتلقطت في routes تحميل وحدات تانية). */
export async function GET(req: Request) {
  const user = await requireCurrentUser();
  try {
    await requirePermission(user.roleId, "Product", "View");
  } catch {
    return new NextResponse("معندكش صلاحية الوصول لهذه البيانات", { status: 403 });
  }

  const orgId = user.orgId;
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
