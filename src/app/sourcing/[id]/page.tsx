import Link from "next/link";
import { notFound } from "next/navigation";
import { getScopedPrisma } from "@/lib/scoped-prisma";
import { getCurrentOrgId } from "@/lib/org";
import { requireCurrentUser } from "@/lib/session";
import { requirePermission } from "@/lib/permissions";
import SupplierRFQForm from "./SupplierRFQForm";
import SupplierQuoteForm from "./SupplierQuoteForm";
import PurchaseOrderForm from "./PurchaseOrderForm";
import { computeEffectiveCostPerSaleableKg } from "@/lib/procurementCompute";
import {
  sourcingRequestStatusLabel,
  sourcingRequestStatusStyle,
  purchaseOrderStatusLabel,
  purchaseOrderStatusStyle,
  supplierRFQStatusLabel,
  supplierRFQStatusStyle,
} from "@/lib/procurementLabels";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function SourcingRequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireCurrentUser();

  try {
    await requirePermission(user.roleId, "SourcingRequest", "View");
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

  const sourcingRequest = await prisma.sourcingRequest.findFirst({
    where: { id, orgId },
    include: {
      deal: { include: { customer: true } },
      product: true,
      market: true,
      quotes: { include: { supplier: true }, orderBy: { createdAt: "desc" } },
      purchaseOrders: { include: { supplier: true, facility: true }, orderBy: { createdAt: "desc" } },
      supplierRFQs: { include: { supplier: true }, orderBy: { createdAt: "desc" } },
    },
  });
  if (!sourcingRequest) notFound();

  // ⚠️ مش Promise.all — راجع BACKLOG.md (P2028).
  const suppliers = await prisma.supplier.findMany({
    where: { orgId, deletedAt: null },
    select: { id: true, legalName: true },
    orderBy: { legalName: "asc" },
  });
  const facilities = await prisma.facility.findMany({
    where: { orgId },
    select: { id: true, name: true, supplierId: true },
    orderBy: { name: "asc" },
  });
  const specifications = await prisma.productSpecification.findMany({
    where: { orgId, productId: sourcingRequest.productId },
    select: { id: true, version: true, status: true },
    orderBy: { version: "desc" },
  });

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <Button nativeButton={false} variant="link" className="px-0" render={<Link href="/sourcing">← رجوع لطلبات التوريد</Link>} />

      <div className="mt-3 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            {sourcingRequest.deal.customer.legalName} — {sourcingRequest.product.nameAr}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {sourcingRequest.market.countryNameAr} · الحد الأقصى للسعر: {sourcingRequest.maximumPurchasePrice.toString()} {sourcingRequest.currency}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={sourcingRequestStatusStyle[sourcingRequest.status]}>{sourcingRequestStatusLabel[sourcingRequest.status]}</Badge>
          <Button nativeButton={false} variant="outline" size="sm" render={<Link href={`/deals/${sourcingRequest.dealId}`}>عرض الصفقة</Link>} />
        </div>
      </div>

      <section className="mt-8">
        <h2 className="text-lg font-medium text-foreground">طلبات عروض الأسعار (RFQ)</h2>
        <div className="mt-3">
          <SupplierRFQForm sourcingRequestId={sourcingRequest.id} suppliers={suppliers} />
        </div>
        <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>المورّد</TableHead>
                <TableHead>رقم الطلب</TableHead>
                <TableHead>آخر موعد للرد</TableHead>
                <TableHead>الحالة</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sourcingRequest.supplierRFQs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-6 text-center text-muted-foreground">
                    لسه مفيش طلبات عروض أسعار مسجّلة.
                  </TableCell>
                </TableRow>
              ) : (
                sourcingRequest.supplierRFQs.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium text-foreground">{r.supplier.legalName}</TableCell>
                    <TableCell className="text-foreground/80">{r.rfqNumber ?? "—"}</TableCell>
                    <TableCell className="text-foreground/80">{r.responseDeadline ? formatDate(r.responseDeadline) : "—"}</TableCell>
                    <TableCell>
                      <Badge className={supplierRFQStatusStyle[r.status]}>{supplierRFQStatusLabel[r.status]}</Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-medium text-foreground">عروض الموردين</h2>
        <div className="mt-3">
          <SupplierQuoteForm sourcingRequestId={sourcingRequest.id} suppliers={suppliers} />
        </div>
        <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>المورّد</TableHead>
                <TableHead>سعر الوحدة</TableHead>
                <TableHead>مدة التوريد</TableHead>
                <TableHead>تكلفة الكيلو الصافي (⚙️)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sourcingRequest.quotes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-6 text-center text-muted-foreground">
                    لسه مفيش عروض موردين مسجّلة.
                  </TableCell>
                </TableRow>
              ) : (
                sourcingRequest.quotes.map((q) => {
                  const perKg = computeEffectiveCostPerSaleableKg(q.totalEffectiveCost, q.availableQuantity, q.expectedYield);
                  return (
                    <TableRow key={q.id}>
                      <TableCell className="font-medium text-foreground">{q.supplier.legalName}</TableCell>
                      <TableCell className="font-mono text-foreground/80">
                        {q.unitPrice.toString()} {q.currency} {q.priceUnit ? `/ ${q.priceUnit}` : ""}
                      </TableCell>
                      <TableCell className="font-mono text-foreground/80">{q.leadTimeDays ? `${q.leadTimeDays} يوم` : "—"}</TableCell>
                      <TableCell className="font-mono text-foreground/80">{perKg !== null ? `${perKg.toFixed(2)} ${q.currency}` : "—"}</TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-medium text-foreground">أوامر الشراء</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          سعر الوحدة فوق الحد الأقصى المسموح ({sourcingRequest.maximumPurchasePrice.toString()} {sourcingRequest.currency}) هيتمنع على مستوى القاعدة، ويتحوّل لطلب موافقة استثنائية من صفحة الموافقات.
        </p>
        <div className="mt-3">
          <PurchaseOrderForm
            sourcingRequestId={sourcingRequest.id}
            suppliers={suppliers}
            facilities={facilities}
            specifications={specifications}
            maximumPurchasePrice={sourcingRequest.maximumPurchasePrice.toString()}
            currency={sourcingRequest.currency}
          />
        </div>
        <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>رقم الأمر</TableHead>
                <TableHead>المورّد</TableHead>
                <TableHead>الكمية</TableHead>
                <TableHead>سعر الوحدة</TableHead>
                <TableHead>الحالة</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sourcingRequest.purchaseOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-6 text-center text-muted-foreground">
                    لسه مفيش أوامر شراء مسجّلة.
                  </TableCell>
                </TableRow>
              ) : (
                sourcingRequest.purchaseOrders.map((po) => (
                  <TableRow key={po.id}>
                    <TableCell className="font-mono text-foreground">
                      <Button nativeButton={false} variant="link" className="h-auto p-0 font-mono" render={<Link href={`/purchase-orders/${po.id}`}>{po.poNumber}</Link>} />
                    </TableCell>
                    <TableCell className="text-foreground/80">{po.supplier.legalName}</TableCell>
                    <TableCell className="font-mono text-foreground/80">{po.quantity.toString()}</TableCell>
                    <TableCell className="font-mono text-foreground/80">
                      {po.unitPrice.toString()} {po.currency}
                    </TableCell>
                    <TableCell>
                      <Badge className={purchaseOrderStatusStyle[po.status]}>{purchaseOrderStatusLabel[po.status]}</Badge>
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
