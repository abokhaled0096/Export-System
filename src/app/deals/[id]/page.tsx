import Link from "next/link";
import { notFound } from "next/navigation";
import { getScopedPrisma } from "@/lib/scoped-prisma";
import { requireCurrentUser } from "@/lib/session";
import { getPermissionScope, scopedOwnerIdFilter, getFieldAccess } from "@/lib/permissions";
import AcceptQuoteButton from "./AcceptQuoteButton";
import SendQuoteEmailButton from "./SendQuoteEmailButton";
import ConfirmSalesOrderForm from "./ConfirmSalesOrderForm";
import MarkDealLostForm from "./MarkDealLostForm";
import DocumentForm from "./DocumentForm";
import DocumentPackageForm from "./DocumentPackageForm";
import DocumentVersionForm from "./DocumentVersionForm";
import CommissionEntryForm from "./CommissionEntryForm";
import CommissionEntryActions from "./CommissionEntryActions";
import { documentTypeLabel, documentStatusLabel, documentStatusStyle, documentEtaStatusLabel, documentEtaStatusStyle } from "@/lib/documentLabels";
import { documentPackageTypeLabel, documentPackageStatusLabel, documentPackageStatusStyle } from "@/lib/documentPackageLabels";
import { commissionEntryStatusLabel, commissionEntryStatusStyle } from "@/lib/commissionLabels";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const dynamic = "force-dynamic";
// sendQuoteEmail (deals/actions.ts) بيولّد PDF بـChromium (quote-pdf.ts) قبل الإرسال — نفس سبب
// maxDuration في routes التحميل، الحد الافتراضي (10 ثواني على Vercel Hobby) ممكن ميكفيش.
export const maxDuration = 60;

const salesOrderStatusLabel: Record<string, string> = {
  Draft: "مسودة",
  Confirmed: "مؤكّد",
  InProduction: "قيد الإنتاج",
  PartiallyDelivered: "تسليم جزئي",
  Delivered: "اتسلّم",
  Invoiced: "اتفوتر",
  Closed: "مقفول",
  Cancelled: "ملغى",
};

const statusLabel: Record<string, string> = {
  Draft: "مسودة",
  Pricing: "جاري التسعير",
  Negotiation: "تفاوض",
  Approved: "معتمدة",
  Won: "مكسوبة",
  Lost: "خسرانة",
  Cancelled: "ملغاة",
};

const quoteStatusLabel: Record<string, string> = {
  Draft: "مسودة",
  PendingApproval: "بانتظار الموافقة",
  Sent: "اتبعت للعميل",
  Accepted: "اتقبلت",
  Rejected: "اترفضت",
  Expired: "منتهية",
  Superseded: "استُبدلت",
};

export default async function DealDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireCurrentUser();
  const orgId = user.orgId;
  const prisma = await getScopedPrisma();
  const org = await prisma.organization.findUniqueOrThrow({ where: { id: orgId }, select: { functionalCurrency: true } });
  // فصل مهام حقيقي: SalesRep (Own scope) بيشوف السعر النهائي/المستهدف بس، مش الحد الأدنى/نقطة
  // التعادل (بيانات تسعير داخلية) — المفاوض مايشوفش الحد اللي يقدر يرفض تحته، نفس فلسفة عزل
  // معلومات التفاوض الحساسة عن اللي بيتفاوض فعليًا. بقى مبني على جدول FieldPermission (وحدة 9،
  // راجع STATUS.md 7 سبتمبر) بدل إعادة استخدام Deal.View scope كـproxy — الحقول الخمسة
  // (walkAwayPrice/breakEvenPrice/الربح والهامش) بتتخفى مع بعض دايمًا، فحقل واحد ممثّل كافي.
  const canSeeInternalPricing = (await getFieldAccess(user.roleId, "DealScenario", "walkAwayPrice")) !== "Hidden";
  // ⚠️ IDOR — نفس الفحص المطبَّق في /deals (القائمة) كان ناقص هنا، يعني SalesRep (Own scope)
  // كان يقدر يفتح أي صفقة في المنظمة برابط مباشر (اتكشف في إعادة مراجعة وحدة 2، 7 سبتمبر).
  const dealViewScope = await getPermissionScope(user.roleId, "Deal", "View");
  const scopedOwnerId = await scopedOwnerIdFilter(dealViewScope, user);
  const ownerWhere = scopedOwnerId !== undefined ? { opportunity: { ownerId: scopedOwnerId } } : {};

  const deal = await prisma.deal.findFirst({
    where: { id, orgId, ...ownerWhere },
    include: {
      customer: true,
      product: true,
      market: true,
      opportunity: true,
      scenarios: { orderBy: { version: "asc" } },
      quotes: { orderBy: { version: "asc" } },
      salesOrders: { orderBy: { createdAt: "asc" } },
      documents: { orderBy: { createdAt: "desc" } },
      documentPackages: { orderBy: { createdAt: "desc" } },
      commissionEntries: { include: { plan: { select: { name: true } }, user: { select: { fullName: true } } }, orderBy: { createdAt: "desc" } },
    },
  });
  if (!deal) notFound();

  // ⚠️ مش Promise.all — راجع BACKLOG.md (P2028).
  const documentVersions = await prisma.documentVersion.findMany({
    where: { orgId, documentId: { in: deal.documents.map((d) => d.id) } },
    include: { document: { select: { documentNumber: true } } },
    orderBy: { createdAt: "desc" },
  });
  const commissionPlans = await prisma.commissionPlan.findMany({
    where: { orgId },
    select: { id: true, name: true },
    orderBy: { createdAt: "desc" },
  });
  const orgUsers = await prisma.user.findMany({
    where: { orgId },
    select: { id: true, fullName: true },
    orderBy: { fullName: "asc" },
  });

  const dealIsOpen = !["Won", "Lost", "Cancelled"].includes(deal.status);

  const pendingApprovals = await prisma.approval.findMany({
    where: {
      orgId,
      subjectType: "Quote.unitPrice_override",
      decision: "Pending",
      payload: { path: ["dealId"], equals: deal.id },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <Button nativeButton={false} variant="link" className="px-0" render={<Link href="/deals">← رجوع للصفقات</Link>} />

      <div className="mt-3 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            {deal.customer.legalName} — {deal.product.nameAr}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {deal.market.countryNameAr} · {statusLabel[deal.status]}
          </p>
          {deal.status === "Lost" && deal.lostReason && (
            <p className="mt-1 text-xs text-destructive">سبب الخسارة: {deal.lostReason}</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {dealIsOpen && <MarkDealLostForm dealId={deal.id} />}
          {deal.scenarios.length >= 2 && (
            <Button nativeButton={false} variant="outline" render={<Link href={`/deals/${deal.id}/compare`}>قارن السيناريوهات</Link>} />
          )}
          <Button nativeButton={false} render={<Link href={`/deals/${deal.id}/scenarios/new`}>+ سيناريو جديد</Link>} />
        </div>
      </div>

      <section className="mt-8">
        <h2 className="text-lg font-medium text-foreground">السيناريوهات</h2>
        {deal.scenarios.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">لسه مفيش سيناريو تسعير لهذه الصفقة.</p>
        ) : (
          <Card className="mt-3">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>الاسم</TableHead>
                    <TableHead>الكمية القابلة للبيع</TableHead>
                    {canSeeInternalPricing && <TableHead>نقطة التعادل</TableHead>}
                    {canSeeInternalPricing && <TableHead>الحد الأدنى</TableHead>}
                    <TableHead>السعر النهائي</TableHead>
                    <TableHead>الحالة</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deal.scenarios.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell>
                        <Link
                          href={`/deals/${deal.id}/scenarios/${s.id}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {s.scenarioName} (v{s.version})
                        </Link>
                      </TableCell>
                      <TableCell className="font-mono">{s.quantitySaleable.toString()}</TableCell>
                      {canSeeInternalPricing && (
                        <TableCell className="font-mono">
                          {s.breakEvenPrice ? `${s.breakEvenPrice.toString()} ${s.currency}` : "—"}
                        </TableCell>
                      )}
                      {canSeeInternalPricing && (
                        <TableCell className="font-mono">
                          {s.walkAwayPrice.toString()} {s.currency}
                        </TableCell>
                      )}
                      <TableCell className="font-mono">
                        {s.finalPrice ? `${s.finalPrice.toString()} ${s.currency}` : "—"}
                      </TableCell>
                      <TableCell>
                        {s.isLocked ? (
                          <Badge variant="secondary">مقفول</Badge>
                        ) : (
                          <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">مفتوح للتعديل</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </section>

      {pendingApprovals.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-medium text-foreground">طلبات موافقة استثنائية معلّقة</h2>
          <div className="mt-3 flex flex-col gap-2">
            {pendingApprovals.map((a) => {
              const p = a.payload as { unitPrice: number; currency: string; priceUnit: string; walkAwayPrice: string };
              return (
                <div key={a.id} className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  السعر المطلوب {p.unitPrice} {p.currency}/{p.priceUnit}
                  {canSeeInternalPricing ? ` (أقل من الحد الأدنى ${p.walkAwayPrice})` : " (أقل من الحد الأدنى المسموح)"} —
                  في انتظار قرار المدير.
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="mt-8">
        <h2 className="text-lg font-medium text-foreground">عروض الأسعار</h2>
        {deal.quotes.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">لسه مفيش عرض سعر لهذه الصفقة.</p>
        ) : (
          <Card className="mt-3">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>النسخة</TableHead>
                    <TableHead>السعر</TableHead>
                    <TableHead>Incoterm</TableHead>
                    <TableHead>الحالة</TableHead>
                    <TableHead></TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deal.quotes.map((q) => (
                    <TableRow key={q.id}>
                      <TableCell>v{q.version}</TableCell>
                      <TableCell className="font-mono">
                        {q.unitPrice.toString()} {q.currency} / {q.priceUnit}
                      </TableCell>
                      <TableCell>{q.incoterm}</TableCell>
                      <TableCell>
                        {quoteStatusLabel[q.status]}
                        {q.status === "Sent" && (
                          <div className="text-xs text-muted-foreground">
                            {new Intl.DateTimeFormat("ar-EG", { dateStyle: "medium" }).format(q.updatedAt)}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Button
                            nativeButton={false}
                            variant="link"
                            className="h-auto p-0"
                            render={<Link href={`/deals/${deal.id}/quotes/${q.id}/pdf`} target="_blank">PDF</Link>}
                          />
                          {q.status !== "Rejected" && q.status !== "Expired" && q.status !== "Superseded" && (
                            <SendQuoteEmailButton quoteId={q.id} />
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {q.status !== "Accepted" && q.status !== "Rejected" && deal.salesOrders.length === 0 && (
                          <AcceptQuoteButton quoteId={q.id} />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-medium text-foreground">أوامر البيع</h2>
        {deal.salesOrders.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">لسه مفيش أمر بيع — بيتعمل تلقائيًا لما تقبل عرض سعر.</p>
        ) : (
          <div className="mt-3 flex flex-col gap-3">
            {deal.salesOrders.map((so) => (
              <Card key={so.id}>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-foreground">{so.soNumber}</span>
                    {so.status === "Draft" ? (
                      <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">
                        {salesOrderStatusLabel[so.status]}
                      </Badge>
                    ) : (
                      <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                        {salesOrderStatusLabel[so.status]}
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 font-mono text-sm text-foreground/80">
                    {so.totalValue.toString()} {so.currency}
                  </p>
                  {so.poNumber ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      PO: {so.poNumber} — {so.poDate?.toLocaleDateString("ar-EG")}
                    </p>
                  ) : (
                    <ConfirmSalesOrderForm salesOrderId={so.id} />
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-medium text-foreground">المستندات</h2>
        <div className="mt-3">
          <DocumentForm dealId={deal.id} />
        </div>
        {deal.documents.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">لسه مفيش مستندات مسجّلة لهذه الصفقة.</p>
        ) : (
          <Card className="mt-3">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>الرقم</TableHead>
                    <TableHead>النوع</TableHead>
                    <TableHead>النسخة</TableHead>
                    <TableHead>الحالة</TableHead>
                    <TableHead>حالة ETA</TableHead>
                    <TableHead>الملف</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deal.documents.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell className="font-mono text-foreground">{d.documentNumber}</TableCell>
                      <TableCell className="text-foreground/80">{documentTypeLabel[d.documentType]}</TableCell>
                      <TableCell className="font-mono text-foreground/80">{d.version}</TableCell>
                      <TableCell>
                        <Badge className={documentStatusStyle[d.status]}>{documentStatusLabel[d.status]}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={documentEtaStatusStyle[d.etaStatus]}>{documentEtaStatusLabel[d.etaStatus]}</Badge>
                      </TableCell>
                      <TableCell>
                        {d.fileUrl ? (
                          <a href={`/api/documents/${d.id}/file`} className="text-sm text-primary underline" target="_blank" rel="noreferrer">
                            تحميل
                          </a>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-medium text-foreground">حزم المستندات</h2>
        <div className="mt-3">
          <DocumentPackageForm dealId={deal.id} />
        </div>
        {deal.documentPackages.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">لسه مفيش حزم مستندات مسجّلة لهذه الصفقة.</p>
        ) : (
          <Card className="mt-3">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>النوع</TableHead>
                    <TableHead>الحالة</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deal.documentPackages.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="text-foreground">{documentPackageTypeLabel[p.packageType]}</TableCell>
                      <TableCell>
                        <Badge className={documentPackageStatusStyle[p.status]}>{documentPackageStatusLabel[p.status]}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </section>

      {deal.documents.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-medium text-foreground">سجل إصدارات المستندات</h2>
          <div className="mt-3">
            <DocumentVersionForm dealId={deal.id} documents={deal.documents} />
          </div>
          {documentVersions.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">لسه مفيش إصدارات مسجّلة.</p>
          ) : (
            <Card className="mt-3">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>المستند</TableHead>
                      <TableHead>رقم الإصدار</TableHead>
                      <TableHead>سبب التعديل</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {documentVersions.map((v) => (
                      <TableRow key={v.id}>
                        <TableCell className="font-mono text-foreground">{v.document.documentNumber}</TableCell>
                        <TableCell className="font-mono text-foreground/80">{v.versionNumber}</TableCell>
                        <TableCell className="text-foreground/80">{v.changeReason ?? "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </section>
      )}

      <section className="mt-8">
        <h2 className="text-lg font-medium text-foreground">عمولات المبيعات</h2>
        <div className="mt-3">
          <CommissionEntryForm dealId={deal.id} plans={commissionPlans} users={orgUsers} salesOrders={deal.salesOrders} />
        </div>
        {deal.commissionEntries.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">لسه مفيش عمولات مسجّلة لهذه الصفقة.</p>
        ) : (
          <Card className="mt-3">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>الخطة</TableHead>
                    <TableHead>المستخدم</TableHead>
                    <TableHead>المبلغ</TableHead>
                    <TableHead>الحالة</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deal.commissionEntries.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="text-foreground">{c.plan.name}</TableCell>
                      <TableCell className="text-foreground/80">{c.user.fullName}</TableCell>
                      <TableCell className="font-mono text-foreground/80">
                        {c.amount.toString()} {c.currency ?? ""}
                      </TableCell>
                      <TableCell>
                        <Badge className={commissionEntryStatusStyle[c.status]}>{commissionEntryStatusLabel[c.status]}</Badge>
                      </TableCell>
                      <TableCell>
                        <CommissionEntryActions
                          dealId={deal.id}
                          entryId={c.id}
                          status={c.status}
                          currency={c.currency ?? "EGP"}
                          needsFxRate={!!org.functionalCurrency && (c.currency ?? "EGP") !== org.functionalCurrency}
                          functionalCurrency={org.functionalCurrency ?? undefined}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </section>
    </main>
  );
}
