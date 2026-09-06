import Link from "next/link";
import { notFound } from "next/navigation";
import { getScopedPrisma } from "@/lib/scoped-prisma";
import { requireCurrentUser } from "@/lib/session";
import { getPermissionScope, ownerScopeWhere } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import ContactForm from "./ContactForm";

export const dynamic = "force-dynamic";

export default async function NewContactPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireCurrentUser();
  const orgId = user.orgId;
  const prisma = await getScopedPrisma();
  // ⚠️ نفس فجوة IDOR في /deals/[id]/scenarios/new (اتصلحت في إعادة مراجعة وحدة 2، 7 سبتمبر) —
  // كانت بتسرّب اسم شركة مندوب تاني قبل الإرسال حتى لو createContact نفسها بترفض الإنشاء
  // فعليًا (assertOwnScope موجود من الأساس). اتكشفت هنا كمان في إعادة مراجعة وحدة 3 (7 سبتمبر).
  const scope = await getPermissionScope(user.roleId, "Company", "View");
  const ownerFilter = await ownerScopeWhere(scope, user);
  const company = await prisma.company.findFirst({ where: { id, orgId, deletedAt: null, ...ownerFilter } });
  if (!company) notFound();

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <Button nativeButton={false} variant="link" className="h-auto p-0" render={<Link href={`/companies/${company.id}`}>← رجوع لـ{company.legalName}</Link>} />
      <h1 className="mt-3 text-2xl font-semibold text-foreground">جهة اتصال جديدة</h1>
      <div className="mt-8">
        <ContactForm companyId={company.id} />
      </div>
    </main>
  );
}
