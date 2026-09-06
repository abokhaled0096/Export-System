import { NextResponse } from "next/server";
import { toCsv } from "@/lib/csv";
import { bankTransactionTypeLabel } from "@/lib/treasuryLabels";

/** قالب فاضي (سطر عناوين + سطر مثال) لاستيراد كشف حساب بنكي — نفس نمط قالب استيراد المنتجات. */
export async function GET() {
  const example = [
    {
      transactionDate: "2026-09-01",
      amount: "15000.00",
      transactionType: bankTransactionTypeLabel.Deposit,
      reference: "CHK-10234",
      description: "تحصيل دفعة عميل",
    },
  ];

  const csv = toCsv(example, [
    { key: "transactionDate", label: "التاريخ" },
    { key: "amount", label: "المبلغ" },
    { key: "transactionType", label: "نوع الحركة" },
    { key: "reference", label: "المرجع" },
    { key: "description", label: "البيان" },
  ]);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="bank-statement-import-template.csv"`,
    },
  });
}
