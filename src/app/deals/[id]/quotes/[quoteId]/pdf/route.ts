import { NextResponse } from "next/server";
import { getScopedPrisma } from "@/lib/scoped-prisma";
import { getCurrentOrgId } from "@/lib/org";
import { getQuotePdfData } from "@/lib/quote-data";
import { renderQuotePdf } from "@/lib/quote-pdf";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string; quoteId: string }> }) {
  const { quoteId } = await params;
  const orgId = await getCurrentOrgId();
  const prisma = await getScopedPrisma();

  const data = await getQuotePdfData(prisma, quoteId, orgId);
  if (!data) return new NextResponse("عرض السعر غير موجود", { status: 404 });

  const pdf = await renderQuotePdf(data);
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="quote-${data.quoteId.slice(0, 8)}-v${data.version}.pdf"`,
    },
  });
}
