import { NextResponse } from "next/server";
import { getScopedPrisma } from "@/lib/scoped-prisma";
import { requireCurrentUser } from "@/lib/session";
import { requirePermission } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";

/**
 * PDPL — "حق الوصول/النقل". بيصدّر كل البيانات الشخصية المحفوظة عن جهة اتصال كـJSON.
 * بيتسجّل في الـAuditLog نفسه إن التصدير حصل (مين وامتى) — التصدير عملية حساسة برضو.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string; contactId: string }> }) {
  const user = await requireCurrentUser();

  try {
    await requirePermission(user.roleId, "Contact", "Export");
  } catch {
    return new NextResponse("معندكش صلاحية تصدير بيانات جهات الاتصال", { status: 403 });
  }

  const { contactId } = await params;
  const prisma = await getScopedPrisma();
  const contact = await prisma.contact.findFirst({
    where: { id: contactId, orgId: user.orgId },
    include: { company: { select: { legalName: true } } },
  });
  if (!contact) return new NextResponse("جهة الاتصال غير موجودة", { status: 404 });

  const data = {
    id: contact.id,
    name: contact.name,
    title: contact.title,
    email: contact.email,
    decisionRole: contact.decisionRole,
    company: contact.company.legalName,
    consent: { given: contact.consentGiven, at: contact.consentAt },
    erasedAt: contact.erasedAt,
    createdAt: contact.createdAt,
    updatedAt: contact.updatedAt,
  };

  await logAudit(prisma, {
    orgId: user.orgId,
    userId: user.id,
    action: "contact.exported",
    entityType: "Contact",
    entityId: contact.id,
  });

  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="contact-${contact.id.slice(0, 8)}.json"`,
    },
  });
}
