import { NextResponse } from "next/server";
import { getScopedPrisma } from "@/lib/scoped-prisma";
import { requireCurrentUser } from "@/lib/session";
import { getPermissionScope, scopedOwnerIdFilter } from "@/lib/permissions";
import { getQuoteBundlePdfData } from "@/lib/quote-bundle-data";
import { renderQuoteBundlePdf } from "@/lib/quote-pdf";

// راجع نفس التعليق في src/app/deals/[id]/quotes/[quoteId]/pdf/route.ts — Chromium cold start.
export const maxDuration = 60;

/** ⚠️ مراجعة وحدة 2 (6 سبتمبر): كان مفيش أي فحص صلاحية/ملكية هنا خالص — نفس فلتر /quote-bundles. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireCurrentUser();
  const prisma = await getScopedPrisma();

  const scope = await getPermissionScope(user.roleId, "QuoteBundle", "View");
  const scopedOwnerId = await scopedOwnerIdFilter(scope, user);
  const ownerFilter = scopedOwnerId !== undefined ? { quotes: { some: { deal: { opportunity: { ownerId: scopedOwnerId } } } } } : {};
  const authorized = await prisma.quoteBundle.findFirst({ where: { id, orgId: user.orgId, ...ownerFilter }, select: { id: true } });
  if (!authorized) return new NextResponse("الحزمة غير موجودة أو معندكش صلاحية الوصول ليها", { status: 404 });

  const data = await getQuoteBundlePdfData(prisma, id, user.orgId);
  if (!data) return new NextResponse("الحزمة غير موجودة", { status: 404 });

  const pdf = await renderQuoteBundlePdf(data);
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="quote-bundle-${data.bundleId.slice(0, 8)}.pdf"`,
    },
  });
}
