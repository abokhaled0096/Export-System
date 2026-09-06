import Link from "next/link";
import { notFound } from "next/navigation";
import { getScopedPrisma } from "@/lib/scoped-prisma";
import { requireCurrentUser } from "@/lib/session";
import { requirePermission, getPermissionScope, scopedOwnerIdFilter } from "@/lib/permissions";
import RequirementForm from "./RequirementForm";
import RequirementStatusForm from "./RequirementStatusForm";
import GateForm from "./GateForm";
import GateDecisionForm from "./GateDecisionForm";
import HSClassificationForm from "./HSClassificationForm";
import CertificateForm from "./CertificateForm";
import RegistrationForm from "./RegistrationForm";
import OriginProofForm from "./OriginProofForm";
import EditOriginProofForm from "./EditOriginProofForm";
import RejectionCaseForm from "./RejectionCaseForm";
import LCRequirementForm from "./LCRequirementForm";
import ShipmentCreateForm from "../../logistics/ShipmentCreateForm";
import {
  operationTypeLabel,
  complianceCaseStatusLabel,
  complianceCaseStatusStyle,
  requirementCategoryLabel,
  requirementStatusLabel,
  requirementStatusStyle,
  gateStatusLabel,
  gateStatusStyle,
  hsClassificationStatusLabel,
  certificateTypeLabel,
  certificateStatusLabel,
  certificateStatusStyle,
  registrationTypeLabel,
  registrationStatusLabel,
  registrationStatusStyle,
  originProofTypeLabel,
  originProofStatusLabel,
  originProofStatusStyle,
  rejectionTypeLabel,
  rejectionSeverityLabel,
  rejectionSeverityStyle,
  rejectionCaseStatusLabel,
  rejectionCaseStatusStyle,
} from "@/lib/complianceLabels";
import { shipmentStatusLabel, shipmentStatusStyle, transportModeLabel, aciStatusLabel, aciStatusStyle } from "@/lib/logisticsLabels";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const dynamic = "force-dynamic";

export default async function ComplianceCaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireCurrentUser();

  // ⚠️ الصفحة دي كانت بلا أي فحص صلاحية خالص — لا binary permission ولا فلترة Own/Team scope
  // (اتكشف في مراجعة وحدة 5، 6 سبتمبر). أي حد مسجّل دخول في المنظمة كان يقدر يفتح تفاصيل أي
  // ملف امتثال (بيانات صفقة/عميل/بنود مالية) لو عرف/خمّن الـid، بغض النظر عن دوره أو صلاحياته.
  try {
    await requirePermission(user.roleId, "ComplianceCase", "View");
  } catch {
    return (
      <main className="mx-auto max-w-3xl px-6 py-10">
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-6 text-center text-sm text-destructive">
          معندكش صلاحية الوصول للصفحة دي.
        </div>
      </main>
    );
  }

  const orgId = user.orgId;
  const prisma = await getScopedPrisma();

  const scope = await getPermissionScope(user.roleId, "ComplianceCase", "View");
  const scopedOwnerId = await scopedOwnerIdFilter(scope, user);
  const dealOwnerFilter = scopedOwnerId !== undefined ? { opportunity: { ownerId: scopedOwnerId } } : {};

  const kase = await prisma.complianceCase.findFirst({
    where: { id, orgId, deal: dealOwnerFilter },
    include: {
      deal: { include: { customer: true } },
      product: true,
      market: true,
      requirements: { orderBy: { createdAt: "asc" } },
      gates: { orderBy: { gateNumber: "asc" } },
      shipments: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!kase) notFound();

  // ⚠️ مش Promise.all — راجع BACKLOG.md (P2028).
  const hsClassifications = await prisma.hSClassification.findMany({
    where: { orgId, productId: kase.productId, marketId: kase.marketId },
    orderBy: { createdAt: "desc" },
  });
  const certificates = await prisma.certificate.findMany({
    where: { orgId, OR: [{ companyId: kase.deal.customerId }, { productId: kase.productId }] },
    orderBy: { createdAt: "desc" },
  });
  const pendingWaivers = await prisma.approval.findMany({
    where: { orgId, subjectType: "Gate.waiver", decision: "Pending", subjectId: { in: kase.gates.map((g) => g.id) } },
  });
  const pendingWaiverGateIds = new Set(pendingWaivers.map((a) => a.subjectId));
  const registrations = await prisma.registration.findMany({
    where: { orgId, productId: kase.productId },
    orderBy: { createdAt: "desc" },
  });
  const originProofs = await prisma.originProof.findMany({
    where: { orgId, dealId: kase.dealId },
    orderBy: { createdAt: "desc" },
  });
  const rejectionCases = await prisma.rejectionCase.findMany({
    where: { orgId, complianceCaseId: kase.id },
    orderBy: { createdAt: "desc" },
  });
  const lcRequirements = await prisma.lCRequirement.findMany({
    where: { orgId, dealId: kase.dealId },
    orderBy: { createdAt: "desc" },
  });
  const capas = await prisma.cAPA.findMany({
    where: { orgId },
    select: { id: true, rootCause: true, status: true },
    orderBy: { createdAt: "desc" },
  });
  const suppliers = await prisma.supplier.findMany({
    where: { orgId },
    select: { id: true, legalName: true },
    orderBy: { legalName: "asc" },
  });
  const facilities = await prisma.facility.findMany({
    where: { orgId },
    select: { id: true, name: true, supplier: { select: { legalName: true } } },
    orderBy: { name: "asc" },
  });

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <Button nativeButton={false} variant="link" className="px-0" render={<Link href="/compliance">← رجوع لملفات الامتثال</Link>} />

      <div className="mt-3 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            {kase.deal.customer.legalName} — {kase.product.nameAr}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {kase.market.countryNameAr} · {operationTypeLabel[kase.operationType]}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={complianceCaseStatusStyle[kase.status]}>{complianceCaseStatusLabel[kase.status]}</Badge>
          <Button nativeButton={false} variant="outline" size="sm" render={<Link href={`/deals/${kase.dealId}`}>عرض الصفقة</Link>} />
        </div>
      </div>

      <section className="mt-8">
        <h2 className="text-lg font-medium text-foreground">المتطلبات</h2>
        <div className="mt-3">
          <RequirementForm complianceCaseId={kase.id} />
        </div>
        <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الفئة</TableHead>
                <TableHead>المتطلب</TableHead>
                <TableHead>إلزامي</TableHead>
                <TableHead>المسؤول</TableHead>
                <TableHead>الحالة</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {kase.requirements.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-6 text-center text-muted-foreground">
                    لسه مفيش متطلبات مسجّلة.
                  </TableCell>
                </TableRow>
              ) : (
                kase.requirements.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-foreground/80">{requirementCategoryLabel[r.category]}</TableCell>
                    <TableCell className="font-medium text-foreground">{r.name}</TableCell>
                    <TableCell className="text-foreground/80">{r.mandatory ? "نعم" : "لا"}</TableCell>
                    <TableCell className="text-foreground/80">{r.responsibleParty ?? "—"}</TableCell>
                    <TableCell>
                      {/* key فيه status عمدًا — نفس إصلاح TeamAssignForm (30 أغسطس): بعد تحديث
                          الحالة والـrevalidate، defaultValue بيتغيّر على نفس نسخة المكوّن، فـBase UI
                          بيحذّر عن Select غير متحكَّم فيه. الـkey ده بيجبر remount نضيف. */}
                      <RequirementStatusForm
                        key={`${r.id}:${r.status}`}
                        requirementId={r.id}
                        complianceCaseId={kase.id}
                        currentStatus={r.status}
                      />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        {kase.requirements.some((r) => r.status !== "Met" && r.status !== "NotApplicable") && (
          <p className="mt-2 text-xs text-amber-700">
            بعض المتطلبات لسه مش {requirementStatusLabel.Met}/{requirementStatusLabel.NotApplicable} — أي بوابة بتحاجبهم مش هتقدر تعدّي.
          </p>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-medium text-foreground">البوابات (Gates)</h2>
        <div className="mt-3">
          <GateForm
            complianceCaseId={kase.id}
            requirements={kase.requirements.map((r) => ({ id: r.id, name: r.name }))}
            nextGateNumber={(kase.gates.at(-1)?.gateNumber ?? 0) + 1}
          />
        </div>
        <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>البوابة</TableHead>
                <TableHead>متطلبات حاجبة</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead>قرار</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {kase.gates.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-6 text-center text-muted-foreground">
                    لسه مفيش بوابات مسجّلة.
                  </TableCell>
                </TableRow>
              ) : (
                kase.gates.map((g) => (
                  <TableRow key={g.id}>
                    <TableCell className="font-mono text-foreground/80">{g.gateNumber}</TableCell>
                    <TableCell className="font-medium text-foreground">
                      {g.gateName}
                      {g.requiresOriginProofVerification && (
                        <Badge className="ms-2 bg-sky-100 text-sky-700 hover:bg-sky-100">PEM</Badge>
                      )}
                      {g.requiresAciVerification && (
                        <Badge className="ms-2 bg-sky-100 text-sky-700 hover:bg-sky-100">ACI</Badge>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-foreground/80">{g.blockingRequirementIds.length}</TableCell>
                    <TableCell>
                      <Badge className={gateStatusStyle[g.status]}>{gateStatusLabel[g.status]}</Badge>
                    </TableCell>
                    <TableCell>
                      <GateDecisionForm
                        gateId={g.id}
                        complianceCaseId={kase.id}
                        currentStatus={g.status}
                        hasPendingWaiver={pendingWaiverGateIds.has(g.id)}
                      />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-medium text-foreground">الشحنات</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          أي بوابة معلَّمة &quot;تحقق مهلة ACI&quot; لازم يكون فيها شحنة مرتبطة استوفت مهلة الـ48 ساعة قبل ما تعدّي.
        </p>
        <div className="mt-3">
          <ShipmentCreateForm dealId={kase.dealId} complianceCaseId={kase.id} />
        </div>
        <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>وسيلة النقل</TableHead>
                <TableHead>الميناءين</TableHead>
                <TableHead>ACI</TableHead>
                <TableHead>الحالة</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {kase.shipments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-6 text-center text-muted-foreground">
                    لسه مفيش شحنات مرتبطة.
                  </TableCell>
                </TableRow>
              ) : (
                kase.shipments.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="text-foreground/80">{transportModeLabel[s.transportMode]}</TableCell>
                    <TableCell className="text-foreground/80">
                      <Button nativeButton={false} variant="link" className="h-auto p-0" render={<Link href={`/logistics/${s.id}`}>{s.originPort} ← {s.destinationPort}</Link>} />
                    </TableCell>
                    <TableCell>
                      <Badge className={aciStatusStyle[s.aciStatus]}>{aciStatusLabel[s.aciStatus]}</Badge>
                      {s.aciStatus !== "NotRequired" && (
                        <span className={`ms-1 text-xs ${s.aciDeadlineMet ? "text-emerald-700" : "text-rose-700"}`}>
                          {s.aciDeadlineMet ? "مستوفاة" : "غير مستوفاة"}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className={shipmentStatusStyle[s.status]}>{shipmentStatusLabel[s.status]}</Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-medium text-foreground">التصنيف الجمركي (HS Code)</h2>
        <div className="mt-3">
          <HSClassificationForm complianceCaseId={kase.id} productId={kase.productId} marketId={kase.marketId} />
        </div>
        <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>HS Code</TableHead>
                <TableHead>نسبة الرسوم</TableHead>
                <TableHead>مرجع القرار</TableHead>
                <TableHead>الحالة</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {hsClassifications.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-6 text-center text-muted-foreground">
                    لسه مفيش تصنيف جمركي مسجّل.
                  </TableCell>
                </TableRow>
              ) : (
                hsClassifications.map((h) => (
                  <TableRow key={h.id}>
                    <TableCell className="font-mono text-foreground">{h.hsCode}</TableCell>
                    <TableCell className="font-mono text-foreground/80">{h.dutyRatePct ? `${h.dutyRatePct.toString()}%` : "—"}</TableCell>
                    <TableCell className="text-foreground/80">{h.rulingReference ?? "—"}</TableCell>
                    <TableCell className="text-foreground/80">{hsClassificationStatusLabel[h.status]}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-medium text-foreground">الشهادات</h2>
        <div className="mt-3">
          <CertificateForm
            complianceCaseId={kase.id}
            companyId={kase.deal.customerId}
            productId={kase.productId}
            suppliers={suppliers}
            facilities={facilities}
          />
        </div>
        <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>النوع</TableHead>
                <TableHead>الرقم</TableHead>
                <TableHead>الجهة المُصدرة</TableHead>
                <TableHead>الانتهاء</TableHead>
                <TableHead>الحالة</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {certificates.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-6 text-center text-muted-foreground">
                    لسه مفيش شهادات مسجّلة.
                  </TableCell>
                </TableRow>
              ) : (
                certificates.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="text-foreground/80">{certificateTypeLabel[c.certificateType]}</TableCell>
                    <TableCell className="font-mono text-foreground">{c.certificateNumber}</TableCell>
                    <TableCell className="text-foreground/80">{c.issuingAuthority}</TableCell>
                    <TableCell className="text-foreground/80">
                      {c.expiryDate ? c.expiryDate.toLocaleDateString("ar-EG") : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge className={certificateStatusStyle[c.status]}>{certificateStatusLabel[c.status]}</Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-medium text-foreground">التسجيلات</h2>
        <div className="mt-3">
          <RegistrationForm complianceCaseId={kase.id} productId={kase.productId} suppliers={suppliers} facilities={facilities} />
        </div>
        <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>النوع</TableHead>
                <TableHead>الدولة</TableHead>
                <TableHead>الجهة</TableHead>
                <TableHead>رقم التسجيل</TableHead>
                <TableHead>الانتهاء</TableHead>
                <TableHead>الحالة</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {registrations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-6 text-center text-muted-foreground">
                    لسه مفيش تسجيلات مسجّلة.
                  </TableCell>
                </TableRow>
              ) : (
                registrations.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-foreground/80">{registrationTypeLabel[r.registrationType]}</TableCell>
                    <TableCell className="text-foreground/80">{r.country}</TableCell>
                    <TableCell className="text-foreground/80">{r.authority}</TableCell>
                    <TableCell className="font-mono text-foreground">{r.registrationNumber ?? "—"}</TableCell>
                    <TableCell className="text-foreground/80">{r.expiryDate ? r.expiryDate.toLocaleDateString("ar-EG") : "—"}</TableCell>
                    <TableCell>
                      <Badge className={registrationStatusStyle[r.status]}>{registrationStatusLabel[r.status]}</Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-medium text-foreground">إثبات المنشأ</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          قواعد PEM المنقّحة سارية فعليًا — أي بوابة شحن بعلامة PEM لازم تتحقق من عبارة &quot;revised rules&quot; هنا قبل ما تعدّي.
        </p>
        <div className="mt-3">
          <OriginProofForm complianceCaseId={kase.id} dealId={kase.dealId} shipments={kase.shipments} />
        </div>
        <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>النوع</TableHead>
                <TableHead>PEM منقّح</TableHead>
                <TableHead>متحقّق &quot;revised rules&quot;</TableHead>
                <TableHead>رقم الشهادة</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {originProofs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-6 text-center text-muted-foreground">
                    لسه مفيش إثبات منشأ مسجّل.
                  </TableCell>
                </TableRow>
              ) : (
                originProofs.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="text-foreground/80">{originProofTypeLabel[p.proofType]}</TableCell>
                    <TableCell className="text-foreground/80">{p.usesRevisedPemRules ? "نعم" : "لا"}</TableCell>
                    <TableCell className="text-foreground/80">
                      {p.usesRevisedPemRules ? (
                        <Badge
                          className={
                            p.revisedRulesWordingVerified
                              ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100"
                              : "bg-rose-100 text-rose-700 hover:bg-rose-100"
                          }
                        >
                          {p.revisedRulesWordingVerified ? "متحقّق" : "غير متحقّق"}
                        </Badge>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-foreground">{p.certificateNumber ?? "—"}</TableCell>
                    <TableCell>
                      <Badge className={originProofStatusStyle[p.status]}>{originProofStatusLabel[p.status]}</Badge>
                    </TableCell>
                    <TableCell>
                      <EditOriginProofForm
                        complianceCaseId={kase.id}
                        proof={{
                          id: p.id,
                          usesRevisedPemRules: p.usesRevisedPemRules,
                          revisedRulesWordingVerified: p.revisedRulesWordingVerified,
                          cumulationType: p.cumulationType,
                          certificateNumber: p.certificateNumber,
                          issuedDate: p.issuedDate ? p.issuedDate.toISOString().slice(0, 10) : null,
                          issuingAuthority: p.issuingAuthority,
                          status: p.status,
                        }}
                      />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-medium text-foreground">حالات الرفض</h2>
        <div className="mt-3">
          <RejectionCaseForm
            complianceCaseId={kase.id}
            capas={capas}
            shipments={kase.shipments.map((s) => ({ id: s.id, originPort: s.originPort, destinationPort: s.destinationPort }))}
          />
        </div>
        <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>النوع</TableHead>
                <TableHead>الجهة</TableHead>
                <TableHead>الخطورة</TableHead>
                <TableHead>التعرّض المالي</TableHead>
                <TableHead>النتيجة النهائية</TableHead>
                <TableHead>الحالة</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rejectionCases.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-6 text-center text-muted-foreground">
                    لسه مفيش حالات رفض مسجّلة.
                  </TableCell>
                </TableRow>
              ) : (
                rejectionCases.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-foreground/80">{rejectionTypeLabel[r.rejectionType]}</TableCell>
                    <TableCell className="text-foreground/80">{r.authority}</TableCell>
                    <TableCell>
                      <Badge className={rejectionSeverityStyle[r.severity]}>{rejectionSeverityLabel[r.severity]}</Badge>
                    </TableCell>
                    <TableCell className="font-mono text-foreground/80">
                      {r.financialExposure ? `${r.financialExposure.toString()} ${r.currency ?? ""}` : "—"}
                    </TableCell>
                    <TableCell className="max-w-[14rem] whitespace-pre-wrap text-foreground/80">{r.finalResult ?? "—"}</TableCell>
                    <TableCell>
                      <Badge className={rejectionCaseStatusStyle[r.status]}>{rejectionCaseStatusLabel[r.status]}</Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-medium text-foreground">متطلبات خطاب الاعتماد (LC)</h2>
        <div className="mt-3">
          <LCRequirementForm complianceCaseId={kase.id} dealId={kase.dealId} />
        </div>
        <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الرقم</TableHead>
                <TableHead>البنك المُصدر</TableHead>
                <TableHead>المبلغ</TableHead>
                <TableHead>الانتهاء</TableHead>
                <TableHead>شحن جزئي/عابر</TableHead>
                <TableHead>آخر شحن / مهلة التقديم</TableHead>
                <TableHead>المستندات المطلوبة</TableHead>
                <TableHead>الصياغة المطلوبة</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lcRequirements.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-6 text-center text-muted-foreground">
                    لسه مفيش متطلبات خطاب اعتماد مسجّلة.
                  </TableCell>
                </TableRow>
              ) : (
                lcRequirements.map((lc) => (
                  <TableRow key={lc.id}>
                    <TableCell className="font-mono text-foreground">{lc.lcNumber}</TableCell>
                    <TableCell className="text-foreground/80">{lc.issuingBank}</TableCell>
                    <TableCell className="font-mono text-foreground/80">
                      {lc.amount.toString()} {lc.currency}
                    </TableCell>
                    <TableCell className="text-foreground/80">{lc.expiryDate.toLocaleDateString("ar-EG")}</TableCell>
                    <TableCell className="text-foreground/80">
                      {lc.partialShipmentAllowed ? "نعم" : "لا"} / {lc.transshipmentAllowed ? "نعم" : "لا"}
                    </TableCell>
                    <TableCell className="text-foreground/80">
                      {lc.latestShipmentDate ? lc.latestShipmentDate.toLocaleDateString("ar-EG") : "—"}
                      {lc.presentationPeriodDays ? ` / ${lc.presentationPeriodDays} يوم` : ""}
                    </TableCell>
                    <TableCell className="max-w-[16rem] whitespace-pre-wrap text-foreground/80">
                      {lc.requiredDocuments.length > 0 ? lc.requiredDocuments.join("، ") : "—"}
                    </TableCell>
                    <TableCell className="max-w-[16rem] whitespace-pre-wrap text-foreground/80">{lc.requiredWording ?? "—"}</TableCell>
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
