import Link from "next/link";
import { notFound } from "next/navigation";
import { getScopedPrisma } from "@/lib/scoped-prisma";
import { getCurrentOrgId } from "@/lib/org";
import { requireCurrentUser } from "@/lib/session";
import { requirePermission } from "@/lib/permissions";
import InspectionForm from "./InspectionForm";
import QualityReleaseForm from "./QualityReleaseForm";
import LotForm from "./LotForm";
import LabTestForm from "./LabTestForm";
import BatchRawMaterialLineForm from "./BatchRawMaterialLineForm";
import BatchMarketEligibilityForm from "./BatchMarketEligibilityForm";
import { computeYieldRate, computeWasteQuantity } from "@/lib/procurementCompute";
import {
  batchQualityStatusLabel,
  batchQualityStatusStyle,
  batchStatusLabel,
  batchStatusStyle,
  inspectionStageLabel,
  inspectionResultLabel,
  inspectionResultStyle,
  qualityReleaseStatusLabel,
  qualityReleaseStatusStyle,
  lotStatusLabel,
  lotStatusStyle,
  labTestTypeLabel,
  labTestPassFailLabel,
  labTestPassFailStyle,
  batchRawMaterialSourceTypeLabel,
  batchMarketEligibilityStatusLabel,
  batchMarketEligibilityStatusStyle,
} from "@/lib/procurementLabels";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function BatchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireCurrentUser();

  try {
    await requirePermission(user.roleId, "Batch", "View");
  } catch {
    return (
      <main className="mx-auto max-w-3xl px-6 py-10">
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-6 text-center text-sm text-destructive">
          معندكش صلاحية الوصول للصفحة دي — متاحة لـProcurementOfficer/QualityManager/Admin/CompanyOwner.
        </div>
      </main>
    );
  }

  const orgId = await getCurrentOrgId();
  const prisma = await getScopedPrisma();

  const batch = await prisma.batch.findFirst({
    where: { id, orgId },
    include: {
      purchaseOrder: true,
      facility: true,
      supplier: true,
      inspections: { include: { inspector: true }, orderBy: { inspectionDate: "desc" } },
      qualityReleases: { orderBy: { releaseDate: "desc" } },
      lots: { orderBy: { createdAt: "desc" } },
      labTests: { orderBy: { createdAt: "desc" } },
      batchRawMaterialLines: { include: { farm: true, inventory: { include: { product: true } } }, orderBy: { createdAt: "desc" } },
      batchMarketEligibilities: { include: { market: true }, orderBy: { createdAt: "desc" } },
    },
  });
  if (!batch) notFound();

  // ⚠️ مش Promise.all — راجع BACKLOG.md (P2028).
  const farms = await prisma.farm.findMany({
    where: { orgId, supplierId: batch.supplierId },
    select: { id: true, farmerName: true, crop: true },
    orderBy: { createdAt: "desc" },
  });
  const inventoryRecordsRaw = await prisma.inventory.findMany({
    where: { orgId },
    include: { product: true },
    orderBy: { createdAt: "desc" },
  });
  const inventoryRecords = inventoryRecordsRaw.map((r) => ({ id: r.id, label: `${r.product.nameAr} — ${r.quantity.toString()} ${r.unit ?? ""}` }));
  const markets = await prisma.market.findMany({
    where: { orgId, deletedAt: null },
    select: { id: true, countryNameAr: true },
    orderBy: { countryNameAr: "asc" },
  });
  const supplierSamplesRaw = await prisma.supplierSample.findMany({
    where: { orgId, supplierId: batch.supplierId },
    include: { product: true },
    orderBy: { createdAt: "desc" },
  });
  const supplierSamples = supplierSamplesRaw.map((s) => ({ id: s.id, productNameAr: s.product.nameAr }));

  const yieldRate = computeYieldRate(batch.quantityInput, batch.quantityOutput);
  const wasteQuantity = computeWasteQuantity(batch.quantityInput, batch.quantityOutput);

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <Button nativeButton={false} variant="link" className="px-0" render={<Link href={`/purchase-orders/${batch.purchaseOrderId}`}>← رجوع لأمر الشراء</Link>} />

      <div className="mt-3 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{batch.batchCode}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {batch.supplier.legalName} · {batch.facility.name}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={batchQualityStatusStyle[batch.qualityStatus]}>{batchQualityStatusLabel[batch.qualityStatus]}</Badge>
          <Badge className={batchStatusStyle[batch.status]}>{batchStatusLabel[batch.status]}</Badge>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-border bg-card px-4 py-3">
          <p className="text-xs text-muted-foreground">الكمية المدخلة</p>
          <p className="mt-1 font-mono text-foreground">{batch.quantityInput.toString()}</p>
        </div>
        <div className="rounded-xl border border-border bg-card px-4 py-3">
          <p className="text-xs text-muted-foreground">الكمية المخرجة</p>
          <p className="mt-1 font-mono text-foreground">{batch.quantityOutput?.toString() ?? "—"}</p>
        </div>
        <div className="rounded-xl border border-border bg-card px-4 py-3">
          <p className="text-xs text-muted-foreground">نسبة الاستخلاص (⚙️)</p>
          <p className="mt-1 font-mono text-foreground">{yieldRate !== null ? `${(yieldRate * 100).toFixed(1)}%` : "—"}</p>
        </div>
        <div className="rounded-xl border border-border bg-card px-4 py-3">
          <p className="text-xs text-muted-foreground">الهدر (⚙️)</p>
          <p className="mt-1 font-mono text-foreground">{wasteQuantity !== null ? wasteQuantity.toFixed(3) : "—"}</p>
        </div>
      </div>

      <section className="mt-8">
        <h2 className="text-lg font-medium text-foreground">مصدر الخام</h2>
        <div className="mt-3">
          <BatchRawMaterialLineForm batchId={batch.id} farms={farms} inventoryRecords={inventoryRecords} />
        </div>
        <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>النوع</TableHead>
                <TableHead>المصدر</TableHead>
                <TableHead>الكمية</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {batch.batchRawMaterialLines.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="py-6 text-center text-muted-foreground">
                    لسه مفيش خطوط مصدر خام مسجّلة.
                  </TableCell>
                </TableRow>
              ) : (
                batch.batchRawMaterialLines.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="text-foreground">{batchRawMaterialSourceTypeLabel[l.sourceType]}</TableCell>
                    <TableCell className="text-foreground/80">
                      {l.farm ? `${l.farm.farmerName ?? "—"} (${l.farm.crop ?? "—"})` : l.inventory ? l.inventory.product.nameAr : "—"}
                    </TableCell>
                    <TableCell className="font-mono text-foreground/80">{l.quantity?.toString() ?? "—"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-medium text-foreground">الفحوصات</h2>
        <div className="mt-3">
          <InspectionForm batchId={batch.id} />
        </div>
        <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>المرحلة</TableHead>
                <TableHead>المفتّش</TableHead>
                <TableHead>النتيجة</TableHead>
                <TableHead>التاريخ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {batch.inspections.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-6 text-center text-muted-foreground">
                    لسه مفيش فحوصات مسجّلة.
                  </TableCell>
                </TableRow>
              ) : (
                batch.inspections.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell className="text-foreground">{inspectionStageLabel[i.stage]}</TableCell>
                    <TableCell className="text-muted-foreground">{i.inspector.fullName}</TableCell>
                    <TableCell>
                      <Badge className={inspectionResultStyle[i.result]}>{inspectionResultLabel[i.result]}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(i.inspectionDate)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-medium text-foreground">الفحوصات المعملية</h2>
        <div className="mt-3">
          <LabTestForm
            batchId={batch.id}
            inspections={batch.inspections.map((i) => ({ id: i.id, stage: inspectionStageLabel[i.stage] }))}
            supplierSamples={supplierSamples}
          />
        </div>
        <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>نوع الفحص</TableHead>
                <TableHead>المؤشر</TableHead>
                <TableHead>النتيجة الفعلية</TableHead>
                <TableHead>المعمل</TableHead>
                <TableHead>النتيجة</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {batch.labTests.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-6 text-center text-muted-foreground">
                    لسه مفيش فحوصات معملية مسجّلة.
                  </TableCell>
                </TableRow>
              ) : (
                batch.labTests.map((lt) => (
                  <TableRow key={lt.id}>
                    <TableCell className="text-foreground">{labTestTypeLabel[lt.testType]}</TableCell>
                    <TableCell className="text-foreground/80">{lt.parameter ?? "—"}</TableCell>
                    <TableCell className="font-mono text-foreground/80">{lt.actualResult?.toString() ?? "—"}</TableCell>
                    <TableCell className="text-foreground/80">{lt.laboratory ?? "—"}</TableCell>
                    <TableCell>
                      <Badge className={labTestPassFailStyle[lt.passFail]}>{labTestPassFailLabel[lt.passFail]}</Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-medium text-foreground">الإفراج عن الجودة</h2>
        <div className="mt-3">
          <QualityReleaseForm batchId={batch.id} />
        </div>
        <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الحالة</TableHead>
                <TableHead>الكمية المُفرَج عنها</TableHead>
                <TableHead>الكمية المرفوضة</TableHead>
                <TableHead>التاريخ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {batch.qualityReleases.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-6 text-center text-muted-foreground">
                    لسه مفيش إفراجات جودة مسجّلة.
                  </TableCell>
                </TableRow>
              ) : (
                batch.qualityReleases.map((qr) => (
                  <TableRow key={qr.id}>
                    <TableCell>
                      <Badge className={qualityReleaseStatusStyle[qr.status]}>{qualityReleaseStatusLabel[qr.status]}</Badge>
                    </TableCell>
                    <TableCell className="font-mono text-foreground/80">{qr.releasedQuantity?.toString() ?? "—"}</TableCell>
                    <TableCell className="font-mono text-foreground/80">{qr.rejectedQuantity?.toString() ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(qr.releaseDate)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-medium text-foreground">الدفعات الجاهزة (Lots)</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          تسجيل Lot بحالة جودة «مُفرَج عنها» (Released) هيتمنع على مستوى القاعدة لو مفيش إفراج جودة معتمد (فوق) لنفس الدفعة.
        </p>
        <div className="mt-3">
          <LotForm batchId={batch.id} />
        </div>
        <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>كود الـLot</TableHead>
                <TableHead>الكمية</TableHead>
                <TableHead>حالة الجودة</TableHead>
                <TableHead>الحالة</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {batch.lots.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-6 text-center text-muted-foreground">
                    لسه مفيش Lots مسجّلة.
                  </TableCell>
                </TableRow>
              ) : (
                batch.lots.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="font-mono text-foreground">{l.lotCode}</TableCell>
                    <TableCell className="font-mono text-foreground/80">{l.quantity?.toString() ?? "—"}</TableCell>
                    <TableCell>
                      <Badge className={batchQualityStatusStyle[l.qualityStatus]}>{batchQualityStatusLabel[l.qualityStatus]}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={lotStatusStyle[l.status]}>{lotStatusLabel[l.status]}</Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-medium text-foreground">الأهلية للأسواق</h2>
        <div className="mt-3">
          <BatchMarketEligibilityForm batchId={batch.id} markets={markets} />
        </div>
        <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>السوق</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead>السبب</TableHead>
                <TableHead>تاريخ التقييم</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {batch.batchMarketEligibilities.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-6 text-center text-muted-foreground">
                    لسه مفيش تقييمات أهلية مسجّلة.
                  </TableCell>
                </TableRow>
              ) : (
                batch.batchMarketEligibilities.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="text-foreground">{e.market.countryNameAr}</TableCell>
                    <TableCell>
                      <Badge className={batchMarketEligibilityStatusStyle[e.status]}>{batchMarketEligibilityStatusLabel[e.status]}</Badge>
                    </TableCell>
                    <TableCell className="text-foreground/80">{e.reason ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(e.assessedAt)}</TableCell>
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
