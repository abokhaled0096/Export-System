import Link from "next/link";
import { notFound } from "next/navigation";
import { getScopedPrisma } from "@/lib/scoped-prisma";
import { getCurrentOrgId } from "@/lib/org";
import { Button } from "@/components/ui/button";
import ContactForm from "./ContactForm";

export const dynamic = "force-dynamic";

export default async function NewContactPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const orgId = await getCurrentOrgId();
  const prisma = await getScopedPrisma();
  const company = await prisma.company.findFirst({ where: { id, orgId, deletedAt: null } });
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
