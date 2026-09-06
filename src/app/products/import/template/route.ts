import { NextResponse } from "next/server";
import { toCsv } from "@/lib/csv";

/** قالب فاضي (سطر عناوين + سطر مثال) — عشان المستخدم يعرف الصيغة المتوقّعة بالظبط بدل ما يخمّنها من النص. */
export async function GET() {
  const example = [
    {
      nameAr: "فراولة مجمدة",
      nameEn: "Frozen Strawberry",
      hsCode: "0811.10",
      category: "Frozen Fruits",
      originCountry: "Egypt",
      harvestSeason: "مارس-مايو",
      shelfLifeDays: 365,
      requiresRefrigeration: "true",
    },
  ];

  const csv = toCsv(example, [
    { key: "nameAr", label: "الاسم بالعربية" },
    { key: "nameEn", label: "Name (English)" },
    { key: "hsCode", label: "HS Code" },
    { key: "category", label: "الفئة" },
    { key: "originCountry", label: "بلد المنشأ" },
    { key: "harvestSeason", label: "موسم الحصاد" },
    { key: "shelfLifeDays", label: "مدة الصلاحية (يوم)" },
    { key: "requiresRefrigeration", label: "يحتاج تبريد" },
  ]);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="products-import-template.csv"`,
    },
  });
}
