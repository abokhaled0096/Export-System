import Link from "next/link";
import { notFound } from "next/navigation";
import { getScopedPrisma } from "@/lib/scoped-prisma";
import { getCurrentOrgId } from "@/lib/org";
import ShipmentAciForm from "./ShipmentAciForm";
import ShipmentPartyForm from "./ShipmentPartyForm";
import BookingForm from "./BookingForm";
import ContainerForm from "./ContainerForm";
import MilestoneStatusForm from "./MilestoneStatusForm";
import ShipmentEventForm from "./ShipmentEventForm";
import LogisticsExceptionForm from "./LogisticsExceptionForm";
import LogisticsExceptionStatusForm from "./LogisticsExceptionStatusForm";
import FreeTimeRecordForm from "./FreeTimeRecordForm";
import ActualLogisticsCostForm from "./ActualLogisticsCostForm";
import TemperatureLogForm from "./TemperatureLogForm";
import TransportTripForm from "./TransportTripForm";
import TransportTripPhoneCell from "./TransportTripPhoneCell";
import ClaimForm from "./ClaimForm";
import ClaimStatusForm from "./ClaimStatusForm";
import ShipmentLotForm from "./ShipmentLotForm";
import {
  shipmentTypeLabel,
  transportModeLabel,
  loadTypeLabel,
  shipmentStatusLabel,
  shipmentStatusStyle,
  aciStatusLabel,
  aciStatusStyle,
  partyRoleLabel,
  bookingStatusLabel,
  bookingStatusStyle,
  containerTypeLabel,
  milestoneStatusLabel,
  milestoneStatusStyle,
  shipmentEventSourceLabel,
  logisticsExceptionTypeLabel,
  logisticsExceptionSeverityLabel,
  logisticsExceptionSeverityStyle,
  logisticsExceptionStatusLabel,
  logisticsExceptionStatusStyle,
  freeTimeChargeTypeLabel,
  freeTimeLocationLabel,
  transportTripStatusLabel,
  transportTripStatusStyle,
  claimTypeLabel,
  claimStatusLabel,
  claimStatusStyle,
} from "@/lib/logisticsLabels";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const dynamic = "force-dynamic";

export default async function ShipmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const orgId = await getCurrentOrgId();
  const prisma = await getScopedPrisma();

  const shipment = await prisma.shipment.findFirst({
    where: { id, orgId },
    include: {
      deal: { include: { customer: true } },
      product: true,
      parties: { include: { company: true }, orderBy: { createdAt: "asc" } },
      bookings: { include: { provider: true, freightQuote: { include: { route: true } } }, orderBy: { createdAt: "desc" } },
      containers: { orderBy: { createdAt: "asc" } },
      milestones: { orderBy: { sequence: "asc" } },
      events: { orderBy: { occurredAt: "desc" } },
      exceptions: { orderBy: { detectedAt: "desc" } },
      freeTimeRecords: { include: { container: true }, orderBy: { createdAt: "desc" } },
      actualCosts: { orderBy: { createdAt: "desc" } },
      temperatureLogs: { include: { container: true }, orderBy: { recordedAt: "desc" } },
      transportTrips: { orderBy: { createdAt: "desc" } },
      claims: { orderBy: { createdAt: "desc" } },
      shipmentLots: { include: { lot: true }, orderBy: { createdAt: "desc" } },
    },
  });
  if (!shipment) notFound();

  // ⚠️ مش Promise.all — راجع BACKLOG.md (P2028).
  const companies = await prisma.company.findMany({
    where: { orgId, deletedAt: null },
    select: { id: true, legalName: true },
    orderBy: { legalName: "asc" },
  });
  const providers = await prisma.serviceProvider.findMany({
    where: { orgId },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  const freightQuotesRaw = await prisma.freightQuote.findMany({
    where: { orgId },
    include: { route: true, provider: true },
    orderBy: { createdAt: "desc" },
  });
  const freightQuotes = freightQuotesRaw.map((q) => ({
    id: q.id,
    label: `${q.route.originPort} ← ${q.route.destinationPort} (${q.provider.name})`,
  }));
  const lots = await prisma.lot.findMany({
    where: { orgId },
    select: { id: true, lotCode: true },
    orderBy: { createdAt: "desc" },
  });

  const freeTimeChargeDays = (r: (typeof shipment.freeTimeRecords)[number]) => {
    if (!r.startDate || !r.endDate) return null;
    const days = Math.round((r.endDate.getTime() - r.startDate.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(0, days - (r.freeDays ?? 0));
  };

  const costVariance = (c: (typeof shipment.actualCosts)[number]) => {
    if (c.expectedAmount === null || c.actualAmount === null) return null;
    return Number(c.actualAmount) - Number(c.expectedAmount);
  };

  const containerLabel = (c: (typeof shipment.containers)[number]) => {
    const netWeight = c.netWeight ? Number(c.netWeight) : null;
    const maxPayload = c.maxPayload ? Number(c.maxPayload) : null;
    const weightUtilization = netWeight && maxPayload ? Math.round((netWeight / maxPayload) * 100) : null;
    const isOverweight = maxPayload && netWeight ? netWeight > maxPayload : false;
    return { weightUtilization, isOverweight };
  };

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <Button nativeButton={false} variant="link" className="px-0" render={<Link href="/logistics">← رجوع للوجستيات</Link>} />

      <div className="mt-3 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            {shipment.deal.customer.legalName} — {shipment.product.nameAr}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {transportModeLabel[shipment.transportMode]} · {shipmentTypeLabel[shipment.shipmentType]}
            {shipment.loadType ? ` · ${loadTypeLabel[shipment.loadType]}` : ""} · {shipment.originPort} ← {shipment.destinationPort}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={shipmentStatusStyle[shipment.status]}>{shipmentStatusLabel[shipment.status]}</Badge>
          <Button nativeButton={false} variant="outline" size="sm" render={<Link href={`/deals/${shipment.dealId}`}>عرض الصفقة</Link>} />
          {shipment.complianceCaseId && (
            <Button nativeButton={false} variant="outline" size="sm" render={<Link href={`/compliance/${shipment.complianceCaseId}`}>ملف الامتثال</Link>} />
          )}
        </div>
      </div>

      <section className="mt-8">
        <h2 className="text-lg font-medium text-foreground">تصدير ACID</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          الـACID لازم يتصدر قبل 48 ساعة على الأقل من المغادرة (ETD) — أي بوابة شحن معلَّمة &quot;تحقق ACI&quot; هتترفض لحد ما المهلة دي تتحقق.
        </p>
        <div className="mt-3">
          <ShipmentAciForm
            key={`${shipment.aciStatus}:${shipment.aciSubmittedAt?.toISOString() ?? ""}`}
            shipmentId={shipment.id}
            acidNumber={shipment.acidNumber}
            aciStatus={shipment.aciStatus}
            aciSubmittedAt={shipment.aciSubmittedAt ? shipment.aciSubmittedAt.toISOString().slice(0, 16) : null}
          />
        </div>
        <div className="mt-3 flex items-center gap-2 text-sm">
          <Badge className={aciStatusStyle[shipment.aciStatus]}>{aciStatusLabel[shipment.aciStatus]}</Badge>
          {shipment.aciStatus !== "NotRequired" && (
            <span className={shipment.aciDeadlineMet ? "text-emerald-700" : "text-rose-700"}>
              {shipment.aciDeadlineMet ? "مهلة الـ48 ساعة مستوفاة" : "مهلة الـ48 ساعة غير مستوفاة"}
            </span>
          )}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-medium text-foreground">أطراف الشحنة</h2>
        <div className="mt-3">
          <ShipmentPartyForm shipmentId={shipment.id} companies={companies} />
        </div>
        <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الدور</TableHead>
                <TableHead>الشركة</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shipment.parties.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={2} className="py-6 text-center text-muted-foreground">
                    لسه مفيش أطراف مسجّلة.
                  </TableCell>
                </TableRow>
              ) : (
                shipment.parties.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="text-foreground/80">{partyRoleLabel[p.partyRole]}</TableCell>
                    <TableCell className="font-medium text-foreground">{p.company.legalName}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-medium text-foreground">الحجوزات (Bookings)</h2>
        <div className="mt-3">
          <BookingForm shipmentId={shipment.id} providers={providers} freightQuotes={freightQuotes} />
        </div>
        <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>رقم الحجز</TableHead>
                <TableHead>السفينة/الرحلة</TableHead>
                <TableHead>ETD / ETA</TableHead>
                <TableHead>مزوّد الخدمة</TableHead>
                <TableHead>الحالة</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shipment.bookings.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-6 text-center text-muted-foreground">
                    لسه مفيش حجوزات مسجّلة.
                  </TableCell>
                </TableRow>
              ) : (
                shipment.bookings.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-mono text-foreground">{b.bookingNumber ?? "—"}</TableCell>
                    <TableCell className="text-foreground/80">
                      {b.vessel ?? "—"} {b.voyage ? `/ ${b.voyage}` : ""}
                    </TableCell>
                    <TableCell className="text-foreground/80">
                      {b.etd ? b.etd.toLocaleDateString("ar-EG") : "—"} / {b.eta ? b.eta.toLocaleDateString("ar-EG") : "—"}
                    </TableCell>
                    <TableCell className="text-foreground/80">{b.provider?.name ?? "—"}</TableCell>
                    <TableCell>
                      <Badge className={bookingStatusStyle[b.status]}>{bookingStatusLabel[b.status]}</Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-medium text-foreground">الحاويات</h2>
        <div className="mt-3">
          <ContainerForm shipmentId={shipment.id} />
        </div>
        <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الرقم</TableHead>
                <TableHead>النوع</TableHead>
                <TableHead>الختم</TableHead>
                <TableHead>الوزن القائم/الإجمالي</TableHead>
                <TableHead>استغلال الوزن</TableHead>
                <TableHead>درجة التبريد المستهدفة</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shipment.containers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-6 text-center text-muted-foreground">
                    لسه مفيش حاويات مسجّلة.
                  </TableCell>
                </TableRow>
              ) : (
                shipment.containers.map((c) => {
                  const { weightUtilization, isOverweight } = containerLabel(c);
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="font-mono text-foreground">{c.containerNumber ?? "—"}</TableCell>
                      <TableCell className="text-foreground/80">{containerTypeLabel[c.containerType]}</TableCell>
                      <TableCell className="font-mono text-foreground/80">{c.sealNumber ?? "—"}</TableCell>
                      <TableCell className="font-mono text-foreground/80">
                        {c.netWeight?.toString() ?? "—"} / {c.grossWeight?.toString() ?? "—"}
                      </TableCell>
                      <TableCell className="font-mono">
                        {weightUtilization === null ? (
                          "—"
                        ) : (
                          <span className={isOverweight ? "text-rose-700" : "text-foreground/80"}>
                            {weightUtilization}% {isOverweight ? "(تجاوز الوزن)" : ""}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-foreground/80">{c.setPointTempC ? `${c.setPointTempC.toString()}°م` : "—"}</TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-medium text-foreground">المعالم الزمنية (Milestones)</h2>
        <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>المعلم</TableHead>
                <TableHead>الموعد المخطَّط</TableHead>
                <TableHead>الفعلي</TableHead>
                <TableHead>الحالة</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shipment.milestones.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-mono text-foreground/80">{m.sequence}</TableCell>
                  <TableCell className="font-medium text-foreground">{m.milestoneName}</TableCell>
                  <TableCell className="text-foreground/80">{m.plannedDate ? m.plannedDate.toLocaleDateString("ar-EG") : "—"}</TableCell>
                  <TableCell className="text-foreground/80">{m.actualDate ? m.actualDate.toLocaleDateString("ar-EG") : "—"}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Badge className={milestoneStatusStyle[m.status]}>{milestoneStatusLabel[m.status]}</Badge>
                      <MilestoneStatusForm key={`${m.id}:${m.status}`} milestoneId={m.id} shipmentId={shipment.id} currentStatus={m.status} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-medium text-foreground">الأحداث</h2>
        <div className="mt-3">
          <ShipmentEventForm shipmentId={shipment.id} />
        </div>
        <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الحدث</TableHead>
                <TableHead>التاريخ</TableHead>
                <TableHead>الموقع</TableHead>
                <TableHead>المصدر</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shipment.events.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-6 text-center text-muted-foreground">
                    لسه مفيش أحداث مسجّلة.
                  </TableCell>
                </TableRow>
              ) : (
                shipment.events.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-medium text-foreground">{e.eventType}</TableCell>
                    <TableCell className="text-foreground/80">{e.occurredAt.toLocaleString("ar-EG")}</TableCell>
                    <TableCell className="text-foreground/80">{e.location ?? "—"}</TableCell>
                    <TableCell className="text-foreground/80">{shipmentEventSourceLabel[e.source]}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-medium text-foreground">الاستثناءات اللوجستية</h2>
        <div className="mt-3">
          <LogisticsExceptionForm shipmentId={shipment.id} />
        </div>
        <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>النوع</TableHead>
                <TableHead>الخطورة</TableHead>
                <TableHead>التعرّض المالي</TableHead>
                <TableHead>تأثير الجدول</TableHead>
                <TableHead>السبب الجذري</TableHead>
                <TableHead>خطة التعافي</TableHead>
                <TableHead>الحالة</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shipment.exceptions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-6 text-center text-muted-foreground">
                    لسه مفيش استثناءات مسجّلة.
                  </TableCell>
                </TableRow>
              ) : (
                shipment.exceptions.map((ex) => (
                  <TableRow key={ex.id}>
                    <TableCell className="text-foreground/80">{logisticsExceptionTypeLabel[ex.exceptionType]}</TableCell>
                    <TableCell>
                      <Badge className={logisticsExceptionSeverityStyle[ex.severity]}>{logisticsExceptionSeverityLabel[ex.severity]}</Badge>
                    </TableCell>
                    <TableCell className="font-mono text-foreground/80">
                      {ex.financialExposure ? ex.financialExposure.toString() : "—"}
                    </TableCell>
                    <TableCell className="text-foreground/80">{ex.scheduleImpactDays ? `${ex.scheduleImpactDays} يوم` : "—"}</TableCell>
                    <TableCell className="max-w-[12rem] whitespace-pre-wrap text-foreground/80">{ex.rootCause ?? "—"}</TableCell>
                    <TableCell className="max-w-[12rem] whitespace-pre-wrap text-foreground/80">{ex.recoveryPlan ?? "—"}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge className={logisticsExceptionStatusStyle[ex.status]}>{logisticsExceptionStatusLabel[ex.status]}</Badge>
                        <LogisticsExceptionStatusForm
                          key={`${ex.id}:${ex.status}`}
                          exceptionId={ex.id}
                          shipmentId={shipment.id}
                          currentStatus={ex.status}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-medium text-foreground">أيام السماح والغرامات</h2>
        <div className="mt-3">
          <FreeTimeRecordForm
            shipmentId={shipment.id}
            containers={shipment.containers.map((c) => ({ id: c.id, containerNumber: c.containerNumber }))}
          />
        </div>
        <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>النوع</TableHead>
                <TableHead>الموقع</TableHead>
                <TableHead>أيام السماح</TableHead>
                <TableHead>أيام الغرامة</TableHead>
                <TableHead>المسؤول</TableHead>
                <TableHead>التكلفة المقدَّرة</TableHead>
                <TableHead>التكلفة الفعلية</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shipment.freeTimeRecords.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-6 text-center text-muted-foreground">
                    لسه مفيش سجلات مسجّلة.
                  </TableCell>
                </TableRow>
              ) : (
                shipment.freeTimeRecords.map((r) => {
                  const chargeDays = freeTimeChargeDays(r);
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="text-foreground/80">{freeTimeChargeTypeLabel[r.chargeType]}</TableCell>
                      <TableCell className="text-foreground/80">{freeTimeLocationLabel[r.location]}</TableCell>
                      <TableCell className="font-mono text-foreground/80">{r.freeDays ?? "—"}</TableCell>
                      <TableCell className="font-mono">
                        {chargeDays === null ? (
                          "—"
                        ) : (
                          <span className={chargeDays > 0 ? "text-rose-700" : "text-foreground/80"}>{chargeDays} يوم</span>
                        )}
                      </TableCell>
                      <TableCell className="text-foreground/80">{r.responsibleParty ?? "—"}</TableCell>
                      <TableCell className="font-mono text-foreground/80">
                        {r.estimatedCost ? `${r.estimatedCost.toString()} ${r.currency ?? ""}` : "—"}
                      </TableCell>
                      <TableCell className="font-mono text-foreground/80">
                        {r.actualCost ? `${r.actualCost.toString()} ${r.currency ?? ""}` : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-medium text-foreground">التكلفة الفعلية</h2>
        <div className="mt-3">
          <ActualLogisticsCostForm shipmentId={shipment.id} />
        </div>
        <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>النوع</TableHead>
                <TableHead>المتوقع</TableHead>
                <TableHead>الفعلي</TableHead>
                <TableHead>الفرق</TableHead>
                <TableHead>مرجع الفاتورة</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shipment.actualCosts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-6 text-center text-muted-foreground">
                    لسه مفيش تكاليف مسجّلة.
                  </TableCell>
                </TableRow>
              ) : (
                shipment.actualCosts.map((c) => {
                  const variance = costVariance(c);
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium text-foreground">{c.costType}</TableCell>
                      <TableCell className="font-mono text-foreground/80">
                        {c.expectedAmount ? `${c.expectedAmount.toString()} ${c.currency ?? ""}` : "—"}
                      </TableCell>
                      <TableCell className="font-mono text-foreground/80">
                        {c.actualAmount ? `${c.actualAmount.toString()} ${c.currency ?? ""}` : "—"}
                      </TableCell>
                      <TableCell className="font-mono">
                        {variance === null ? (
                          "—"
                        ) : (
                          <span className={variance > 0 ? "text-rose-700" : "text-emerald-700"}>
                            {variance > 0 ? "+" : ""}
                            {variance.toFixed(2)} {c.currency ?? ""}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-foreground/80">{c.invoiceReference ?? "—"}</TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-medium text-foreground">سجل درجة الحرارة</h2>
        <div className="mt-3">
          <TemperatureLogForm
            shipmentId={shipment.id}
            containers={shipment.containers.map((c) => ({ id: c.id, containerNumber: c.containerNumber }))}
          />
        </div>
        <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>التاريخ</TableHead>
                <TableHead>الحرارة</TableHead>
                <TableHead>الرطوبة</TableHead>
                <TableHead>الحاوية</TableHead>
                <TableHead>المصدر / الجهاز</TableHead>
                <TableHead>تجاوز</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shipment.temperatureLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-6 text-center text-muted-foreground">
                    لسه مفيش قراءات مسجّلة.
                  </TableCell>
                </TableRow>
              ) : (
                shipment.temperatureLogs.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="text-foreground/80">{t.recordedAt.toLocaleString("ar-EG")}</TableCell>
                    <TableCell className={`font-mono ${t.isExcursion ? "text-rose-700" : "text-foreground"}`}>
                      {t.temperatureC.toString()}°م
                    </TableCell>
                    <TableCell className="font-mono text-foreground/80">{t.humidityPct ? `${t.humidityPct.toString()}%` : "—"}</TableCell>
                    <TableCell className="text-foreground/80">{t.container?.containerNumber ?? "—"}</TableCell>
                    <TableCell className="text-foreground/80">
                      {t.source ?? "—"}
                      {t.deviceId ? ` (${t.deviceId})` : ""}
                    </TableCell>
                    <TableCell>
                      {t.isExcursion ? <Badge className="bg-rose-100 text-rose-700 hover:bg-rose-100">تجاوز</Badge> : "—"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-medium text-foreground">رحلات النقل البري</h2>
        <div className="mt-3">
          <TransportTripForm shipmentId={shipment.id} />
        </div>
        <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الناقل</TableHead>
                <TableHead>رقم المركبة</TableHead>
                <TableHead>موقع الاستلام</TableHead>
                <TableHead>هاتف السائق</TableHead>
                <TableHead>التكلفة</TableHead>
                <TableHead>الحالة</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shipment.transportTrips.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-6 text-center text-muted-foreground">
                    لسه مفيش رحلات مسجّلة.
                  </TableCell>
                </TableRow>
              ) : (
                shipment.transportTrips.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="text-foreground/80">{t.carrier ?? "—"}</TableCell>
                    <TableCell className="font-mono text-foreground/80">{t.vehicleNumber ?? "—"}</TableCell>
                    <TableCell className="text-foreground/80">{t.pickupLocation ?? "—"}</TableCell>
                    <TableCell>
                      <TransportTripPhoneCell tripId={t.id} shipmentId={shipment.id} hasDriverPhone={t.driverPhoneSecretId != null} />
                    </TableCell>
                    <TableCell className="font-mono text-foreground/80">
                      {t.cost ? `${t.cost.toString()} ${t.currency ?? ""}` : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge className={transportTripStatusStyle[t.status]}>{transportTripStatusLabel[t.status]}</Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-medium text-foreground">المطالبات</h2>
        <div className="mt-3">
          <ClaimForm shipmentId={shipment.id} />
        </div>
        <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>النوع</TableHead>
                <TableHead>المطالَب ضده</TableHead>
                <TableHead>المبلغ المطالَب به</TableHead>
                <TableHead>تاريخ الإخطار</TableHead>
                <TableHead>آخر موعد</TableHead>
                <TableHead>الحالة</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shipment.claims.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-6 text-center text-muted-foreground">
                    لسه مفيش مطالبات مسجّلة.
                  </TableCell>
                </TableRow>
              ) : (
                shipment.claims.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="text-foreground/80">{claimTypeLabel[c.claimType]}</TableCell>
                    <TableCell className="text-foreground/80">{c.claimedAgainst ?? "—"}</TableCell>
                    <TableCell className="font-mono text-foreground/80">
                      {c.claimedAmount ? `${c.claimedAmount.toString()} ${c.currency ?? ""}` : "—"}
                    </TableCell>
                    <TableCell className="text-foreground/80">{c.notificationDate ? c.notificationDate.toLocaleDateString("ar-EG") : "—"}</TableCell>
                    <TableCell className="text-foreground/80">{c.claimDeadline ? c.claimDeadline.toLocaleDateString("ar-EG") : "—"}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge className={claimStatusStyle[c.status]}>{claimStatusLabel[c.status]}</Badge>
                        <ClaimStatusForm key={`${c.id}:${c.status}`} claimId={c.id} shipmentId={shipment.id} currentStatus={c.status} />
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-medium text-foreground">توزيع الدفعات (Lots)</h2>
        {lots.length > 0 && (
          <div className="mt-3">
            <ShipmentLotForm shipmentId={shipment.id} lots={lots} />
          </div>
        )}
        <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>كود الـLot</TableHead>
                <TableHead>الكمية</TableHead>
                <TableHead>الكراتين</TableHead>
                <TableHead>الوزن الصافي</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shipment.shipmentLots.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-6 text-center text-muted-foreground">
                    لسه مفيش دفعات مربوطة بالشحنة دي.
                  </TableCell>
                </TableRow>
              ) : (
                shipment.shipmentLots.map((sl) => (
                  <TableRow key={sl.id}>
                    <TableCell className="font-mono text-foreground">{sl.lot.lotCode}</TableCell>
                    <TableCell className="font-mono text-foreground/80">{sl.quantity?.toString() ?? "—"}</TableCell>
                    <TableCell className="font-mono text-foreground/80">{sl.cartons ?? "—"}</TableCell>
                    <TableCell className="font-mono text-foreground/80">{sl.netWeight?.toString() ?? "—"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>
    </main>
  );
}
