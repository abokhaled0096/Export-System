import Link from "next/link";
import { notFound } from "next/navigation";
import { getScopedPrisma } from "@/lib/scoped-prisma";
import { requireCurrentUser } from "@/lib/session";
import { getPermissionScope, ownerScopeWhere } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import ContactPdplActions from "./ContactPdplActions";
import RedFlagForm from "./RedFlagForm";
import CustomerServiceCaseForm from "./CustomerServiceCaseForm";
import { redFlagSeverityLabel, redFlagSeverityStyle } from "@/lib/redFlagLabels";
import { customerServiceCaseTypeLabel, customerServiceCaseStatusLabel, customerServiceCaseStatusStyle } from "@/lib/customerServiceCaseLabels";
import { companyClassificationLabel } from "@/lib/companyLabels";
import { formatDate } from "@/lib/format";
import { LEAD_SOURCE_TYPE_LABEL } from "@/lib/companySchema";

export const dynamic = "force-dynamic";

export default async function CompanyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireCurrentUser();
  const orgId = user.orgId;
  const canManagePdpl = Boolean(await getPermissionScope(user.roleId, "Contact", "Delete"));
  const prisma = await getScopedPrisma();

  // Own/Team scope كان بيتفلتر في /companies (القائمة) بس، مش هنا — يعني SalesRep (Own) كان يقدر
  // يوصل لتفاصيل شركة مندوب تاني كاملة (جهات اتصال/فرص/أعلام تحذيرية) لو عرف/خمّن الـid بتاعها
  // مباشرة (IDOR حقيقي، اتكشف في مراجعة وحدة 3، 6 سبتمبر) — مختلف عن قرار "scope=null بلا فلترة"
  // الموثّق والمقصود في /companies (ده هنا بيحترم نفس الـscope، مش بيتخطّاه).
  const scope = await getPermissionScope(user.roleId, "Company", "View");
  const ownerFilter = await ownerScopeWhere(scope, user);

  const company = await prisma.company.findFirst({
    where: { id, orgId, deletedAt: null, ...ownerFilter },
    include: {
      contacts: { where: { deletedAt: null }, orderBy: { createdAt: "desc" } },
      opportunities: {
        where: { deletedAt: null },
        include: { product: true, market: true },
        orderBy: { createdAt: "desc" },
      },
      redFlags: { orderBy: { createdAt: "desc" } },
      customerServiceCases: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!company) notFound();

  // ⚠️ مش Promise.all — راجع BACKLOG.md (P2028).
  const capas = await prisma.cAPA.findMany({
    where: { orgId },
    select: { id: true, rootCause: true, status: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <Button nativeButton={false} variant="link" className="h-auto p-0" render={<Link href="/companies">← رجوع لقائمة الشركات</Link>} />
      <div className="mt-3 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{company.legalName}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {company.country}
            {company.city ? ` · ${company.city}` : ""} · {company.classification.map((c) => companyClassificationLabel[c] ?? c).join("، ")}
          </p>
          {/* المصدر معروض مع هوية العميل مش في تبويب جانبي — بيانات متسجّلة ومش
              معروضة بتتعامل عمليًا كأنها مش موجودة. (مواصفة مشروع ٣ §٩) */}
          {company.leadSourceType && (
            <p className="mt-1 text-xs text-muted-foreground">
              المصدر: {LEAD_SOURCE_TYPE_LABEL[company.leadSourceType] ?? company.leadSourceType}
              {company.leadSourceDetail ? ` — ${company.leadSourceDetail}` : ""}
              {company.leadFoundAt ? ` · ${formatDate(company.leadFoundAt)}` : ""}
            </p>
          )}
        </div>
        <Button nativeButton={false} render={<Link href={`/opportunities/new?companyId=${company.id}`}>+ فرصة جديدة</Link>} />
      </div>

      <section className="mt-10">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">جهات الاتصال</h2>
          <Button nativeButton={false} variant="link" className="h-auto p-0" render={<Link href={`/companies/${company.id}/contacts/new`}>+ جهة اتصال</Link>} />
        </div>
        {company.contacts.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">لسه مفيش جهات اتصال.</p>
        ) : (
          <div className="mt-3 flex flex-col gap-2">
            {company.contacts.map((c) => (
              <Card key={c.id}>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">{c.name}</span>
                    {c.title && <span className="text-sm text-muted-foreground"> — {c.title}</span>}
                    {c.erasedAt ? (
                      <Badge variant="secondary">بياناته اتمحت (PDPL)</Badge>
                    ) : c.consentGiven ? (
                      <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">موافقة مسجّلة</Badge>
                    ) : (
                      <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">بلا موافقة مسجّلة</Badge>
                    )}
                  </div>
                  {c.email && <div className="text-xs text-muted-foreground">{c.email}</div>}
                  {canManagePdpl && !c.erasedAt && (
                    <ContactPdplActions companyId={company.id} contactId={c.id} />
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-foreground">الفرص</h2>
        {company.opportunities.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">لسه مفيش فرص مسجّلة لهذه الشركة.</p>
        ) : (
          <div className="mt-3 flex flex-col gap-2">
            {company.opportunities.map((o) => (
              <Link key={o.id} href={`/opportunities/${o.id}`}>
                <Card className="transition-colors hover:bg-accent">
                  <CardContent className="flex items-center text-sm">
                    <span className="font-medium text-foreground">{o.product.nameAr}</span>
                    <span className="mx-1">→</span>
                    {o.market.countryNameAr}
                    <Badge variant="secondary" className="ms-2">
                      {o.stage}
                    </Badge>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-foreground">أعلام تحذيرية</h2>
        <div className="mt-3">
          <RedFlagForm companyId={company.id} />
        </div>
        {company.redFlags.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">لسه مفيش أعلام تحذيرية مسجّلة.</p>
        ) : (
          <div className="mt-3 flex flex-col gap-2">
            {company.redFlags.map((f) => (
              <Card key={f.id}>
                <CardContent className="flex items-center gap-2 text-sm">
                  <span className="font-medium text-foreground">{f.flagType}</span>
                  <Badge className={redFlagSeverityStyle[f.severity]}>{redFlagSeverityLabel[f.severity]}</Badge>
                  {f.blocksDealing && !f.resolvedAt && <Badge className="bg-rose-100 text-rose-700 hover:bg-rose-100">⚠️ يمنع التعامل</Badge>}
                  {f.description && <span className="text-xs text-muted-foreground">— {f.description}</span>}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-foreground">حالات خدمة العملاء</h2>
        <div className="mt-3">
          <CustomerServiceCaseForm companyId={company.id} capas={capas} />
        </div>
        {company.customerServiceCases.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">لسه مفيش حالات خدمة عملاء مسجّلة.</p>
        ) : (
          <div className="mt-3 flex flex-col gap-2">
            {company.customerServiceCases.map((k) => (
              <Card key={k.id}>
                <CardContent className="flex items-center gap-2 text-sm">
                  <span className="font-medium text-foreground">{customerServiceCaseTypeLabel[k.caseType]}</span>
                  <Badge className={customerServiceCaseStatusStyle[k.status]}>{customerServiceCaseStatusLabel[k.status]}</Badge>
                  {k.rootCause && <span className="text-xs text-muted-foreground">— {k.rootCause}</span>}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
