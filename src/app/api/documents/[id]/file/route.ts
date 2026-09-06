import { NextResponse } from "next/server";
import { getScopedPrisma } from "@/lib/scoped-prisma";
import { requireCurrentUser } from "@/lib/session";
import { requirePermission, assertOwnScope } from "@/lib/permissions";
import { getSignedDocumentUrl } from "@/lib/storage";

/** ⚠️ مراجعة وحدة 4 (6 سبتمبر): كان مفيش أي فحص صلاحية/ملكية هنا خالص — نفس ثغرة routes الـPDF
 * في وحدة 2 (عرض السعر/الحزمة). أي حد مسجّل دخول في المنظمة كان يقدر يحمّل ملف أي مستند لو
 * عرف/خمّن الـid، بغض النظر عن Own/Team scope الصفقة المرتبطة. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireCurrentUser();
  const prisma = await getScopedPrisma();

  const document = await prisma.document.findFirst({
    where: { id, orgId: user.orgId },
    select: { fileUrl: true, deal: { select: { opportunity: { select: { ownerId: true } } } } },
  });
  if (!document) return new NextResponse("المستند غير موجود", { status: 404 });
  try {
    const scope = await requirePermission(user.roleId, "Document", "Create");
    await assertOwnScope(scope, document.deal.opportunity.ownerId, user);
  } catch {
    return new NextResponse("معندكش صلاحية الوصول لهذا المستند", { status: 403 });
  }
  if (!document.fileUrl) return new NextResponse("مفيش ملف مرفوع لهذا المستند", { status: 404 });

  const signedUrl = await getSignedDocumentUrl(document.fileUrl);
  return NextResponse.redirect(signedUrl);
}
