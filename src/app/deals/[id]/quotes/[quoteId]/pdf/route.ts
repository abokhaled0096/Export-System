import { NextResponse } from "next/server";
import { getScopedPrisma } from "@/lib/scoped-prisma";
import { requireCurrentUser } from "@/lib/session";
import { requirePermission, assertOwnScope } from "@/lib/permissions";
import { getQuotePdfData } from "@/lib/quote-data";
import { renderQuotePdf } from "@/lib/quote-pdf";

// توليد PDF بـChromium (cold start + رندر) ممكن ياخد أكتر من الـ10 ثواني الافتراضية على Vercel
// Hobby — بلا الحد الأقصى ده، أول طلب بعد فترة خمول ممكن يترفض بـTimeout قبل ما Chromium يخلّص.
export const maxDuration = 60;

/** ⚠️ مراجعة وحدة 2 (6 سبتمبر): كان مفيش أي فحص صلاحية/ملكية هنا خالص — أي مستخدم مسجّل دخول
 * في المنظمة يقدر يحمّل PDF أي عرض سعر بس لو عرف/خمّن الـid بتاعه، بغض النظر عن Own/Team scope. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string; quoteId: string }> }) {
  const { quoteId } = await params;
  const user = await requireCurrentUser();
  const prisma = await getScopedPrisma();

  const ownerCheck = await prisma.quote.findFirst({ where: { id: quoteId, orgId: user.orgId }, include: { deal: { include: { opportunity: { select: { ownerId: true } } } } } });
  if (!ownerCheck) return new NextResponse("عرض السعر غير موجود", { status: 404 });
  try {
    const scope = await requirePermission(user.roleId, "Quote", "Create");
    await assertOwnScope(scope, ownerCheck.deal.opportunity.ownerId, user);
  } catch {
    return new NextResponse("معندكش صلاحية الوصول لعرض السعر ده", { status: 403 });
  }

  const data = await getQuotePdfData(prisma, quoteId, user.orgId);
  if (!data) return new NextResponse("عرض السعر غير موجود", { status: 404 });

  const pdf = await renderQuotePdf(data);
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="quote-${data.quoteId.slice(0, 8)}-v${data.version}.pdf"`,
    },
  });
}
