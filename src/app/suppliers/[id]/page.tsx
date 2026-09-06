import Link from "next/link";
import { notFound } from "next/navigation";
import { getScopedPrisma } from "@/lib/scoped-prisma";
import { getCurrentOrgId } from "@/lib/org";
import { requireCurrentUser } from "@/lib/session";
import { requirePermission } from "@/lib/permissions";
import FacilityForm from "./FacilityForm";
import NCRForm from "./NCRForm";
import FarmForm from "./FarmForm";
import SupplierAuditForm from "./SupplierAuditForm";
import SupplierSampleForm from "./SupplierSampleForm";
import SupplyContractForm from "./SupplyContractForm";
import PackagingMaterialForm from "./PackagingMaterialForm";
import SupplierPerformanceForm from "./SupplierPerformanceForm";
import SupplierBankInfoForm from "./SupplierBankInfoForm";
import { Tabs, TabsList, TabsTab, TabsPanel } from "@/components/ui/tabs";
import {
  supplierTypeLabel,
  supplierStatusLabel,
  supplierStatusStyle,
  facilityTypeLabel,
  facilityStatusLabel,
  facilityStatusStyle,
  ncrTypeLabel,
  ncrSeverityLabel,
  ncrSeverityStyle,
  ncrStatusLabel,
  ncrStatusStyle,
  farmRiskLevelLabel,
  farmRiskLevelStyle,
  supplierAuditDecisionLabel,
  supplierAuditDecisionStyle,
  supplierSamplePurposeLabel,
  supplierSampleResultLabel,
  supplierSampleResultStyle,
  supplierSampleStatusLabel,
  supplyContractTypeLabel,
  supplyContractStatusLabel,
  supplyContractStatusStyle,
  packagingMaterialTypeLabel,
  packagingMaterialStatusLabel,
  packagingMaterialStatusStyle,
  supplierPerformanceClassificationLabel,
  supplierPerformanceClassificationStyle,
} from "@/lib/procurementLabels";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const dynamic = "force-dynamic";

export default async function SupplierDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireCurrentUser();

  try {
    await requirePermission(user.roleId, "Supplier", "View");
  } catch {
    return (
      <main className="mx-auto max-w-3xl px-6 py-10">
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-6 text-center text-sm text-destructive">
          معندكش صلاحية الوصول للصفحة دي — متاحة لـProcurementOfficer/Admin/CompanyOwner.
        </div>
      </main>
    );
  }

  const orgId = await getCurrentOrgId();
  const prisma = await getScopedPrisma();

  const supplier = await prisma.supplier.findFirst({
    where: { id, orgId },
    include: {
      facilities: { orderBy: { createdAt: "desc" } },
      ncrs: { include: { facility: true }, orderBy: { createdAt: "desc" } },
      farms: { orderBy: { createdAt: "desc" } },
      audits: { include: { facility: true }, orderBy: { createdAt: "desc" } },
      samples: { include: { product: true }, orderBy: { createdAt: "desc" } },
      contracts: { orderBy: { createdAt: "desc" } },
      packagingMaterials: { orderBy: { createdAt: "desc" } },
      performances: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!supplier) notFound();

  // ⚠️ مش Promise.all — راجع BACKLOG.md (P2028).
  const products = await prisma.product.findMany({
    where: { orgId, deletedAt: null },
    select: { id: true, nameAr: true },
    orderBy: { nameAr: "asc" },
  });
  const capas = await prisma.cAPA.findMany({
    where: { orgId },
    select: { id: true, rootCause: true, status: true },
    orderBy: { createdAt: "desc" },
  });
  const documents = await prisma.document.findMany({
    where: { orgId },
    select: { id: true, documentNumber: true, documentType: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <Button nativeButton={false} variant="link" className="px-0" render={<Link href="/suppliers">← رجوع للموردين</Link>} />

      <div className="mt-3 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{supplier.legalName}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {supplier.tradeName ?? "—"} · {supplier.country ?? "—"}
            {supplier.supplierType.length > 0 ? ` · ${supplier.supplierType.map((t) => supplierTypeLabel[t] ?? t).join("، ")}` : ""}
          </p>
        </div>
        <Badge className={supplierStatusStyle[supplier.status]}>{supplierStatusLabel[supplier.status]}</Badge>
      </div>

      <Tabs defaultValue="overview" className="mt-8">
        <TabsList>
          <TabsTab value="overview">نظرة عامة</TabsTab>
          <TabsTab value="quality">الجودة والتدقيق</TabsTab>
          <TabsTab value="commercial">تجاري وأداء</TabsTab>
        </TabsList>

        <TabsPanel value="overview">
          <section>
            <h2 className="text-lg font-medium text-foreground">المنشآت</h2>
            <div className="mt-3">
              <FacilityForm supplierId={supplier.id} />
            </div>
            <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>الاسم</TableHead>
                    <TableHead>النوع</TableHead>
                    <TableHead>الطاقة اليومية</TableHead>
                    <TableHead>نظام تتبّع</TableHead>
                    <TableHead>الحالة</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {supplier.facilities.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-6 text-center text-muted-foreground">
                        لسه مفيش منشآت مسجّلة.
                      </TableCell>
                    </TableRow>
                  ) : (
                    supplier.facilities.map((f) => (
                      <TableRow key={f.id}>
                        <TableCell className="font-medium text-foreground">{f.name}</TableCell>
                        <TableCell className="text-foreground/80">{facilityTypeLabel[f.facilityType]}</TableCell>
                        <TableCell className="font-mono text-foreground/80">{f.capacityDaily ? f.capacityDaily.toString() : "—"}</TableCell>
                        <TableCell className="text-foreground/80">{f.hasTraceabilitySystem ? "نعم" : "لا"}</TableCell>
                        <TableCell>
                          <Badge className={facilityStatusStyle[f.status]}>{facilityStatusLabel[f.status]}</Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </section>

          <section className="mt-8">
            <h2 className="text-lg font-medium text-foreground">المزارع</h2>
            <div className="mt-3">
              <FarmForm supplierId={supplier.id} />
            </div>
            <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>المزارع</TableHead>
                    <TableHead>المحصول</TableHead>
                    <TableHead>المساحة (فدان)</TableHead>
                    <TableHead>الكمية المتوقعة</TableHead>
                    <TableHead>الخطورة</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {supplier.farms.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-6 text-center text-muted-foreground">
                        لسه مفيش مزارع مسجّلة.
                      </TableCell>
                    </TableRow>
                  ) : (
                    supplier.farms.map((f) => (
                      <TableRow key={f.id}>
                        <TableCell className="font-medium text-foreground">{f.farmerName ?? "—"}</TableCell>
                        <TableCell className="text-foreground/80">{f.crop ?? "—"}</TableCell>
                        <TableCell className="font-mono text-foreground/80">{f.areaFeddan?.toString() ?? "—"}</TableCell>
                        <TableCell className="font-mono text-foreground/80">{f.expectedQuantity?.toString() ?? "—"}</TableCell>
                        <TableCell>
                          <Badge className={farmRiskLevelStyle[f.riskLevel]}>{farmRiskLevelLabel[f.riskLevel]}</Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </section>
        </TabsPanel>

        <TabsPanel value="quality">
          <section>
            <h2 className="text-lg font-medium text-foreground">مخالفات عدم المطابقة (NCR)</h2>
            {supplier.facilities.length > 0 && (
              <div className="mt-3">
                <NCRForm supplierId={supplier.id} facilities={supplier.facilities.map((f) => ({ id: f.id, name: f.name }))} capas={capas} />
              </div>
            )}
            <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>المنشأة</TableHead>
                    <TableHead>النوع</TableHead>
                    <TableHead>الخطورة</TableHead>
                    <TableHead>الكمية المتأثرة</TableHead>
                    <TableHead>التعرّض المالي</TableHead>
                    <TableHead>الاحتواء الفوري</TableHead>
                    <TableHead>الحالة</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {supplier.ncrs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="py-6 text-center text-muted-foreground">
                        لسه مفيش مخالفات مسجّلة.
                      </TableCell>
                    </TableRow>
                  ) : (
                    supplier.ncrs.map((n) => (
                      <TableRow key={n.id}>
                        <TableCell className="text-foreground">{n.facility.name}</TableCell>
                        <TableCell className="text-foreground/80">{ncrTypeLabel[n.ncrType]}</TableCell>
                        <TableCell>
                          <Badge className={ncrSeverityStyle[n.severity]}>{ncrSeverityLabel[n.severity]}</Badge>
                        </TableCell>
                        <TableCell className="font-mono text-foreground/80">{n.quantityAffected?.toString() ?? "—"}</TableCell>
                        <TableCell className="font-mono text-foreground/80">
                          {n.financialExposure ? `${n.financialExposure.toString()} ${n.currency ?? ""}` : "—"}
                        </TableCell>
                        <TableCell className="max-w-[14rem] whitespace-pre-wrap text-foreground/80">{n.immediateContainment ?? "—"}</TableCell>
                        <TableCell>
                          <Badge className={ncrStatusStyle[n.status]}>{ncrStatusLabel[n.status]}</Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </section>

          <section className="mt-8">
            <h2 className="text-lg font-medium text-foreground">تدقيقات الموردين</h2>
            <div className="mt-3">
              <SupplierAuditForm supplierId={supplier.id} facilities={supplier.facilities.map((f) => ({ id: f.id, name: f.name }))} />
            </div>
            <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>المنشأة</TableHead>
                    <TableHead>تاريخ التدقيق</TableHead>
                    <TableHead>الدرجة الإجمالية</TableHead>
                    <TableHead>ملاحظات (حرجة/كبيرة/صغيرة)</TableHead>
                    <TableHead>القرار</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {supplier.audits.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-6 text-center text-muted-foreground">
                        لسه مفيش تدقيقات مسجّلة.
                      </TableCell>
                    </TableRow>
                  ) : (
                    supplier.audits.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell className="text-foreground">{a.facility?.name ?? "—"}</TableCell>
                        <TableCell className="text-foreground/80">{a.auditDate ? a.auditDate.toLocaleDateString("ar-EG") : "—"}</TableCell>
                        <TableCell className="font-mono text-foreground/80">{a.totalScore?.toString() ?? "—"}</TableCell>
                        <TableCell className="font-mono text-foreground/80">
                          {a.criticalFindings ?? "—"} / {a.majorFindings ?? "—"} / {a.minorFindings ?? "—"}
                        </TableCell>
                        <TableCell>
                          <Badge className={supplierAuditDecisionStyle[a.decision]}>{supplierAuditDecisionLabel[a.decision]}</Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </section>

          <section className="mt-8">
            <h2 className="text-lg font-medium text-foreground">عينات الموردين</h2>
            <div className="mt-3">
              <SupplierSampleForm supplierId={supplier.id} products={products} />
            </div>
            <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>المنتج</TableHead>
                    <TableHead>الغرض</TableHead>
                    <TableHead>الكمية</TableHead>
                    <TableHead>النتيجة</TableHead>
                    <TableHead>الحالة</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {supplier.samples.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-6 text-center text-muted-foreground">
                        لسه مفيش عينات مسجّلة.
                      </TableCell>
                    </TableRow>
                  ) : (
                    supplier.samples.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="text-foreground">{s.product.nameAr}</TableCell>
                        <TableCell className="text-foreground/80">{supplierSamplePurposeLabel[s.purpose]}</TableCell>
                        <TableCell className="font-mono text-foreground/80">{s.quantity?.toString() ?? "—"}</TableCell>
                        <TableCell>
                          <Badge className={supplierSampleResultStyle[s.result]}>{supplierSampleResultLabel[s.result]}</Badge>
                        </TableCell>
                        <TableCell className="text-foreground/80">{supplierSampleStatusLabel[s.status]}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </section>
        </TabsPanel>

        <TabsPanel value="commercial">
          <section>
            <h2 className="text-lg font-medium text-foreground">البيانات البنكية</h2>
            <div className="mt-3">
              <SupplierBankInfoForm
                supplierId={supplier.id}
                hasBankAccountName={supplier.bankAccountNameSecretId != null}
                hasBankIBAN={supplier.bankIBANSecretId != null}
              />
            </div>
          </section>

          <section className="mt-8">
            <h2 className="text-lg font-medium text-foreground">عقود التوريد</h2>
            <div className="mt-3">
              <SupplyContractForm supplierId={supplier.id} documents={documents} />
            </div>
            <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>النوع</TableHead>
                    <TableHead>البداية</TableHead>
                    <TableHead>النهاية</TableHead>
                    <TableHead>الحالة</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {supplier.contracts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="py-6 text-center text-muted-foreground">
                        لسه مفيش عقود مسجّلة.
                      </TableCell>
                    </TableRow>
                  ) : (
                    supplier.contracts.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="text-foreground">{supplyContractTypeLabel[c.contractType]}</TableCell>
                        <TableCell className="text-foreground/80">{c.startDate ? c.startDate.toLocaleDateString("ar-EG") : "—"}</TableCell>
                        <TableCell className="text-foreground/80">{c.endDate ? c.endDate.toLocaleDateString("ar-EG") : "—"}</TableCell>
                        <TableCell>
                          <Badge className={supplyContractStatusStyle[c.status]}>{supplyContractStatusLabel[c.status]}</Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </section>

          <section className="mt-8">
            <h2 className="text-lg font-medium text-foreground">مواد التعبئة</h2>
            <div className="mt-3">
              <PackagingMaterialForm supplierId={supplier.id} />
            </div>
            <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>النوع</TableHead>
                    <TableHead>الكمية (مطلوبة/مقبولة)</TableHead>
                    <TableHead>تكلفة الوحدة</TableHead>
                    <TableHead>الحالة</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {supplier.packagingMaterials.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="py-6 text-center text-muted-foreground">
                        لسه مفيش مواد تعبئة مسجّلة.
                      </TableCell>
                    </TableRow>
                  ) : (
                    supplier.packagingMaterials.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell className="text-foreground">{packagingMaterialTypeLabel[m.materialType]}</TableCell>
                        <TableCell className="font-mono text-foreground/80">
                          {m.quantityOrdered?.toString() ?? "—"} / {m.quantityAccepted?.toString() ?? "—"}
                        </TableCell>
                        <TableCell className="font-mono text-foreground/80">
                          {m.unitCost ? `${m.unitCost.toString()} ${m.currency ?? ""}` : "—"}
                        </TableCell>
                        <TableCell>
                          <Badge className={packagingMaterialStatusStyle[m.status]}>{packagingMaterialStatusLabel[m.status]}</Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </section>

          <section className="mt-8">
            <h2 className="text-lg font-medium text-foreground">تقييم أداء المورد</h2>
            <div className="mt-3">
              <SupplierPerformanceForm supplierId={supplier.id} />
            </div>
            <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>الفترة</TableHead>
                    <TableHead>الدرجة الإجمالية</TableHead>
                    <TableHead>الالتزام بالمواعيد %</TableHead>
                    <TableHead>التصنيف</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {supplier.performances.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="py-6 text-center text-muted-foreground">
                        لسه مفيش تقييمات مسجّلة.
                      </TableCell>
                    </TableRow>
                  ) : (
                    supplier.performances.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="text-foreground/80">
                          {p.periodStart.toLocaleDateString("ar-EG")} — {p.periodEnd.toLocaleDateString("ar-EG")}
                        </TableCell>
                        <TableCell className="font-mono text-foreground/80">{p.overallScore?.toString() ?? "—"}</TableCell>
                        <TableCell className="font-mono text-foreground/80">{p.onTimeDeliveryRate?.toString() ?? "—"}</TableCell>
                        <TableCell>
                          {p.classification ? (
                            <Badge className={supplierPerformanceClassificationStyle[p.classification]}>
                              {supplierPerformanceClassificationLabel[p.classification]}
                            </Badge>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </section>
        </TabsPanel>
      </Tabs>
    </main>
  );
}
