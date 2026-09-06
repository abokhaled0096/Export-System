import { NextResponse } from "next/server";
import { getScopedPrisma } from "@/lib/scoped-prisma";
import { getCurrentOrgId } from "@/lib/org";
import { getSignedDocumentUrl } from "@/lib/storage";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const orgId = await getCurrentOrgId();
  const prisma = await getScopedPrisma();

  const document = await prisma.document.findFirst({ where: { id, orgId }, select: { fileUrl: true } });
  if (!document || !document.fileUrl) return new NextResponse("مفيش ملف مرفوع لهذا المستند", { status: 404 });

  const signedUrl = await getSignedDocumentUrl(document.fileUrl);
  return NextResponse.redirect(signedUrl);
}
