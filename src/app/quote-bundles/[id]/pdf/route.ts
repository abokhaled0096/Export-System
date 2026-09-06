import { NextResponse } from "next/server";
import { getScopedPrisma } from "@/lib/scoped-prisma";
import { getCurrentOrgId } from "@/lib/org";
import { getQuoteBundlePdfData } from "@/lib/quote-bundle-data";
import { renderQuoteBundlePdf } from "@/lib/quote-pdf";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const orgId = await getCurrentOrgId();
  const prisma = await getScopedPrisma();

  const data = await getQuoteBundlePdfData(prisma, id, orgId);
  if (!data) return new NextResponse("الحزمة غير موجودة", { status: 404 });

  const pdf = await renderQuoteBundlePdf(data);
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="quote-bundle-${data.bundleId.slice(0, 8)}.pdf"`,
    },
  });
}
