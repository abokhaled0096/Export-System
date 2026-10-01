import Link from "next/link";
import { notFound } from "next/navigation";
import { getScopedPrisma } from "@/lib/scoped-prisma";
import { getCurrentOrgId } from "@/lib/org";
import { requireCurrentUser } from "@/lib/session";
import { requirePermission } from "@/lib/permissions";
import BatchForm from "./BatchForm";
import ProductionPlanForm from "./ProductionPlanForm";
import CargoReadinessForm from "./CargoReadinessForm";
import { computeYieldRate, computeWasteQuantity } from "@/lib/procurementCompute";
import {
  purchaseOrderStatusLabel,
  purchaseOrderStatusStyle,
  batchQualityStatusLabel,
  batchQualityStatusStyle,
  batchStatusLabel,
  batchStatusStyle,
  productionProcessLabel,
  productionPlanStatusLabel,
  productionPlanStatusStyle,
  cargoReadinessStatusLabel,
  cargoReadinessStatusStyle,
} from "@/lib/procurementLabels";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function PurchaseOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireCurrentUser();

  try {
    await requirePermission(user.roleId, "PurchaseOrder", "View");
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

  const purchaseOrder = await prisma.purchaseOrder.findFirst({
    where: { id, orgId },
    include: {
      supplier: true,
      facility: true,
      sourcingRequest: { include: { deal: { include: { customer: true } }, product: true } },
      batches: { orderBy: { createdAt: "desc" } },
      productionPlans: { include: { facility: true }, orderBy: { createdAt: "desc" } },
      cargoReadiness: { include: { shipment: { include: { deal: { include: { customer: true } } } } }, orderBy: { createdAt: "desc" } },
    },
  });
  if (!purchaseOrder) notFound();

  // ⚠️ مش Promise.all — راجع BACKLOG.md (P2028).
  const facilities = await prisma.facility.findMany({
    where: { orgId, supplierId: purchaseOrder.supplierId },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  const shipmentsRaw = await prisma.shipment.findMany({
    where: { orgId, deletedAt: null },
    include: { deal: { include: { customer: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const shipments = shipmentsRaw.map((s) => ({
    id: s.id,
    label: `${s.deal.customer.legalName} — ${s.originPort} → ${s.destinationPort}`,
  }));


  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <Button nativeButton={false} variant="link" className="px-0" render={<Link href={`/sourcing/${purchaseOrder.sourcingRequestId}`}>← رجوع لطلب التوريد</Link>} />

      <div className="mt-3 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{purchaseOrder.poNumber}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {purchaseOrder.supplier.legalName} · {purchaseOrder.sourcingRequest.deal.customer.legalName} — {purchaseOrder.sourcingRequest.product.nameAr}
          </p>
        </div>
        <Badge className={purchaseOrderStatusStyle[purchaseOrder.status]}>{purchaseOrderStatusLabel[purchaseOrder.status]}</Badge>
      </div>

      <div className="mt-4 rounded-xl border border-border bg-card px-4 py-3 text-sm">
        <p className="text-xs text-muted-foreground">تفاصيل الأمر</p>
        <p className="mt-1 font-mono text-foreground">
          {purchaseOrder.quantity.toString()} × {purchaseOrder.unitPrice.toString()} {purchaseOrder.currency}
          {purchaseOrder.facility && <span className="ms-2 text-muted-foreground">· المنشأة: {purchaseOrder.facility.name}</span>}
        </p>
        {purchaseOrder.paymentTerms && <p className="mt-2 text-foreground/80">شروط الدفع: {purchaseOrder.paymentTerms}</p>}
        {purchaseOrder.penalties && <p className="mt-1 text-foreground/80">الجزاءات: {purchaseOrder.penalties}</p>}
      </div>

      <section className="mt-8">
        <h2 className="text-lg font-medium text-foreground">خطط الإنتاج</h2>
        <div className="mt-3">
          <ProductionPlanForm purchaseOrderId={purchaseOrder.id} facilities={facilities} supplierId={purchaseOrder.supplierId} />
        </div>
        <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>المنشأة</TableHead>
                <TableHead>المعالجة</TableHead>
                <TableHead>الكمية الخام</TableHead>
                <TableHead>جاهزية الشحن</TableHead>
                <TableHead>الحالة</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {purchaseOrder.productionPlans.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-6 text-center text-muted-foreground">
                    لسه مفيش خطط إنتاج مسجّلة.
                  </TableCell>
                </TableRow>
              ) : (
                purchaseOrder.productionPlans.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="text-foreground">{p.facility.name}</TableCell>
                    <TableCell className="text-foreground/80">{productionProcessLabel[p.process]}</TableCell>
                    <TableCell className="font-mono text-foreground/80">{p.rawQuantity?.toString() ?? "—"}</TableCell>
                    <TableCell className="text-foreground/80">{p.cargoReadyDate ? formatDate(p.cargoReadyDate) : "—"}</TableCell>
                    <TableCell>
                      <Badge className={productionPlanStatusStyle[p.status]}>{productionPlanStatusLabel[p.status]}</Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-medium text-foreground">دفعات الإنتاج</h2>
        <div className="mt-3">
          <BatchForm purchaseOrderId={purchaseOrder.id} facilities={facilities} supplierId={purchaseOrder.supplierId} />
        </div>
        <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>كود الدفعة</TableHead>
                <TableHead>الكمية (مدخلة/مخرجة)</TableHead>
                <TableHead>نسبة الاستخلاص (⚙️)</TableHead>
                <TableHead>الهدر (⚙️)</TableHead>
                <TableHead>حالة الجودة</TableHead>
                <TableHead>الحالة</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {purchaseOrder.batches.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-6 text-center text-muted-foreground">
                    لسه مفيش دفعات إنتاج مسجّلة.
                  </TableCell>
                </TableRow>
              ) : (
                purchaseOrder.batches.map((b) => {
                  const yr = computeYieldRate(b.quantityInput, b.quantityOutput);
                  const wq = computeWasteQuantity(b.quantityInput, b.quantityOutput);
                  return (
                    <TableRow key={b.id}>
                      <TableCell className="font-medium text-foreground">
                        <Button nativeButton={false} variant="link" className="h-auto p-0 font-medium" render={<Link href={`/batches/${b.id}`}>{b.batchCode}</Link>} />
                      </TableCell>
                      <TableCell className="font-mono text-foreground/80">
                        {b.quantityInput.toString()} / {b.quantityOutput?.toString() ?? "—"}
                      </TableCell>
                      <TableCell className="font-mono text-foreground/80">{yr !== null ? `${(yr * 100).toFixed(1)}%` : "—"}</TableCell>
                      <TableCell className="font-mono text-foreground/80">{wq !== null ? wq.toFixed(3) : "—"}</TableCell>
                      <TableCell>
                        <Badge className={batchQualityStatusStyle[b.qualityStatus]}>{batchQualityStatusLabel[b.qualityStatus]}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={batchStatusStyle[b.status]}>{batchStatusLabel[b.status]}</Badge>
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
        <h2 className="text-lg font-medium text-foreground">جاهزية الشحن (Cargo Readiness)</h2>
        <div className="mt-3">
          <CargoReadinessForm purchaseOrderId={purchaseOrder.id} shipments={shipments} />
        </div>
        <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الشحنة</TableHead>
                <TableHead>درجة الجاهزية</TableHead>
                <TableHead>تاريخ الجاهزية</TableHead>
                <TableHead>الحالة</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {purchaseOrder.cargoReadiness.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-6 text-center text-muted-foreground">
                    لسه مفيش تقييمات جاهزية شحن مسجّلة.
                  </TableCell>
                </TableRow>
              ) : (
                purchaseOrder.cargoReadiness.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="text-foreground">
                      {c.shipment.deal.customer.legalName} — {c.shipment.originPort} → {c.shipment.destinationPort}
                    </TableCell>
                    <TableCell className="font-mono text-foreground/80">{c.readinessScore?.toString() ?? "—"}</TableCell>
                    <TableCell className="text-foreground/80">{c.readyDate ? formatDate(c.readyDate) : "—"}</TableCell>
                    <TableCell>
                      <Badge className={cargoReadinessStatusStyle[c.status]}>{cargoReadinessStatusLabel[c.status]}</Badge>
                    </TableCell>
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
