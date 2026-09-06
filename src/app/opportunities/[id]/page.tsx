import Link from "next/link";
import { notFound } from "next/navigation";
import { getScopedPrisma } from "@/lib/scoped-prisma";
import { getCurrentOrgId } from "@/lib/org";
import CommunicationForm from "./CommunicationForm";
import RFQAnalysisForm from "./RFQAnalysisForm";
import CustomerSampleForm from "./CustomerSampleForm";
import NegotiationForm from "./NegotiationForm";
import NegotiationRoundForm from "./NegotiationRoundForm";
import StageTransitionButtons from "./StageTransitionButtons";
import { opportunityStageLabel } from "@/lib/opportunityLabels";
import { communicationChannelLabel, communicationDirectionLabel } from "@/lib/communicationLabels";
import { rfqSeriousnessLevelLabel, rfqSeriousnessLevelStyle } from "@/lib/rfqAnalysisLabels";
import { customerSampleStatusLabel, customerSampleStatusStyle } from "@/lib/customerSampleLabels";
import { negotiationStatusLabel, negotiationStatusStyle, negotiationConcessionTypeLabel } from "@/lib/negotiationLabels";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const dynamic = "force-dynamic";

export default async function OpportunityDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const orgId = await getCurrentOrgId();
  const prisma = await getScopedPrisma();

  const opportunity = await prisma.opportunity.findFirst({
    where: { id, orgId },
    include: {
      company: { include: { contacts: { where: { deletedAt: null } } } },
      contact: true,
      product: true,
      market: true,
      communications: { orderBy: { occurredAt: "desc" } },
      rfqAnalyses: { orderBy: { createdAt: "desc" } },
      customerSamples: { orderBy: { createdAt: "desc" } },
      negotiations: { include: { rounds: { orderBy: { roundNumber: "asc" } } }, orderBy: { createdAt: "desc" } },
    },
  });
  if (!opportunity) notFound();

  // ⚠️ مش Promise.all — راجع BACKLOG.md (P2028).
  const batches = await prisma.batch.findMany({
    where: { orgId },
    select: { id: true, batchCode: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <Button nativeButton={false} variant="link" className="h-auto p-0" render={<Link href="/opportunities">← رجوع للفرص</Link>} />
      <div className="mt-3 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            {opportunity.product.nameAr} → {opportunity.market.countryNameAr}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            <Link href={`/companies/${opportunity.company.id}`} className="underline">
              {opportunity.company.legalName}
            </Link>
            {opportunity.contact ? ` · ${opportunity.contact.name}` : ""}
          </p>
        </div>
        <Badge variant="secondary">{opportunityStageLabel[opportunity.stage] ?? opportunity.stage}</Badge>
      </div>

      <div className="mt-3">
        <StageTransitionButtons opportunityId={opportunity.id} stage={opportunity.stage} />
      </div>

      <section className="mt-8">
        <h2 className="text-lg font-medium text-foreground">التواصل</h2>
        <div className="mt-3">
          <CommunicationForm opportunityId={opportunity.id} companyId={opportunity.company.id} contacts={opportunity.company.contacts} />
        </div>
        {opportunity.communications.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">لسه مفيش تواصل مسجّل.</p>
        ) : (
          <Card className="mt-3">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>القناة</TableHead>
                    <TableHead>الاتجاه</TableHead>
                    <TableHead>الموضوع</TableHead>
                    <TableHead>الملخص</TableHead>
                    <TableHead>التاريخ</TableHead>
                    <TableHead>مدة الرد (ساعة)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {opportunity.communications.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="text-foreground">{communicationChannelLabel[c.channel]}</TableCell>
                      <TableCell className="text-foreground/80">{communicationDirectionLabel[c.direction]}</TableCell>
                      <TableCell className="text-foreground/80">{c.subject ?? "—"}</TableCell>
                      <TableCell className="max-w-[16rem] whitespace-pre-wrap text-foreground/80">{c.summary ?? "—"}</TableCell>
                      <TableCell className="text-foreground/80">{c.occurredAt.toLocaleString("ar-EG")}</TableCell>
                      <TableCell className="font-mono text-foreground/80">{c.responseTimeHours?.toString() ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-medium text-foreground">تحليل طلبات العروض (RFQ)</h2>
        <div className="mt-3">
          <RFQAnalysisForm opportunityId={opportunity.id} communications={opportunity.communications} />
        </div>
        {opportunity.rfqAnalyses.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">لسه مفيش تحليلات RFQ مسجّلة.</p>
        ) : (
          <Card className="mt-3">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ميناء الوصول</TableHead>
                    <TableHead>طريقة الدفع</TableHead>
                    <TableHead>الكمية</TableHead>
                    <TableHead>Incoterm</TableHead>
                    <TableHead>مستوى الجدّية</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {opportunity.rfqAnalyses.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="text-foreground">{r.destinationPort ?? "—"}</TableCell>
                      <TableCell className="text-foreground/80">{r.paymentMethod ?? "—"}</TableCell>
                      <TableCell className="font-mono text-foreground/80">{r.quantity?.toString() ?? "—"}</TableCell>
                      <TableCell className="text-foreground/80">{r.incoterm ?? "—"}</TableCell>
                      <TableCell>
                        {r.seriousnessLevel ? (
                          <Badge className={rfqSeriousnessLevelStyle[r.seriousnessLevel]}>{rfqSeriousnessLevelLabel[r.seriousnessLevel]}</Badge>
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
        <h2 className="text-lg font-medium text-foreground">عينات العملاء</h2>
        <div className="mt-3">
          <CustomerSampleForm opportunityId={opportunity.id} productId={opportunity.product.id} productLabel={opportunity.product.nameAr} batches={batches} />
        </div>
        {opportunity.customerSamples.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">لسه مفيش عينات مسجّلة.</p>
        ) : (
          <Card className="mt-3">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>الكمية</TableHead>
                    <TableHead>رقم التتبّع</TableHead>
                    <TableHead>الحالة</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {opportunity.customerSamples.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-mono text-foreground">{s.quantity?.toString() ?? "—"}</TableCell>
                      <TableCell className="text-foreground/80">{s.trackingNumber ?? "—"}</TableCell>
                      <TableCell>
                        <Badge className={customerSampleStatusStyle[s.status]}>{customerSampleStatusLabel[s.status]}</Badge>
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
        <h2 className="text-lg font-medium text-foreground">التفاوض</h2>
        <div className="mt-3">
          <NegotiationForm opportunityId={opportunity.id} />
        </div>
        {opportunity.negotiations.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">لسه مفيش تفاوض مسجّل.</p>
        ) : (
          <div className="mt-3 flex flex-col gap-4">
            {opportunity.negotiations.map((n) => (
              <Card key={n.id}>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <Badge className={negotiationStatusStyle[n.status]}>{negotiationStatusLabel[n.status]}</Badge>
                    {n.currentPrice && (
                      <span className="text-sm text-foreground/80">
                        السعر الحالي: {n.currentPrice.toString()} {n.currency ?? ""}
                      </span>
                    )}
                  </div>
                  {n.rounds.length > 0 && (
                    <Table className="mt-3">
                      <TableHeader>
                        <TableRow>
                          <TableHead>#</TableHead>
                          <TableHead>عرض العميل</TableHead>
                          <TableHead>عرضنا</TableHead>
                          <TableHead>الخصم %</TableHead>
                          <TableHead>نوع التنازل</TableHead>
                          <TableHead>النتيجة</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {n.rounds.map((r) => (
                          <TableRow key={r.id}>
                            <TableCell className="font-mono text-foreground">{r.roundNumber}</TableCell>
                            <TableCell className="font-mono text-foreground/80">{r.customerOffer?.toString() ?? "—"}</TableCell>
                            <TableCell className="font-mono text-foreground/80">{r.ourOffer?.toString() ?? "—"}</TableCell>
                            <TableCell className="font-mono text-foreground/80">{r.discountPct?.toString() ?? "—"}</TableCell>
                            <TableCell className="text-foreground/80">{r.concessionType ? negotiationConcessionTypeLabel[r.concessionType] : "—"}</TableCell>
                            <TableCell className="text-foreground/80">{r.outcome ?? "—"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                  <div className="mt-3">
                    <NegotiationRoundForm opportunityId={opportunity.id} negotiationId={n.id} nextRoundNumber={n.rounds.length + 1} />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
