import { NextResponse } from "next/server";
import { toCsv } from "@/lib/csv";

/** قالب فاضي (سطر عناوين + سطر مثال) — عشان المستخدم يعرف الصيغة المتوقّعة بالظبط بدل ما يخمّنها من النص. */
export async function GET() {
  const example = [
    {
      legalName: "Muster Import GmbH",
      tradeName: "Muster",
      country: "Germany",
      city: "Hamburg",
      classification: "Importer؛ Distributor",
    },
  ];

  const csv = toCsv(example, [
    { key: "legalName", label: "الاسم القانوني" },
    { key: "tradeName", label: "الاسم التجاري" },
    { key: "country", label: "الدولة" },
    { key: "city", label: "المدينة" },
    { key: "classification", label: "التصنيف" },
  ]);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="companies-import-template.csv"`,
    },
  });
}
