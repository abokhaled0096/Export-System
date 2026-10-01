import Link from "next/link";
import { notFound } from "next/navigation";
import { getScopedPrisma } from "@/lib/scoped-prisma";
import { requireCurrentUser } from "@/lib/session";
import { getPermissionScope, scopedOwnerIdFilter, getFieldAccess } from "@/lib/permissions";
import CostItemForm from "./CostItemForm";
import RiskItemForm from "./RiskItemForm";
import FinalPriceForm from "./FinalPriceForm";
import LockButton from "./LockButton";
import OpenComplianceCaseForm from "./OpenComplianceCaseForm";
import OpenSourcingRequestForm from "./OpenSourcingRequestForm";
import { complianceCaseStatusLabel } from "@/lib/complianceLabels";
import { sourcingRequestStatusLabel } from "@/lib/procurementLabels";
import { containerTypeLabel } from "@/lib/logisticsLabels";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import DealScoreCard from "./DealScoreCard";
import { computeDealScore, computeCostConfidenceScore } from "@/lib/dealScoring";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const dynamic = "force-dynamic";

const categoryLabel: Record<string, string> = {
  Product: "المنتج",
  Processing: "تصنيع/معالجة",
  Packaging: "تعبئة",
  Quality: "جودة",
  ExportLogistics: "لوجستيات تصدير",
  InternationalFreight: "شحن دولي",
  DestinationCharges: "رسوم الوجهة",
  SellingAdmin: "إداري/بيعي",
  Finance: "تمويل",
  RiskReserve: "احتياطي مخاطر",
};

const riskTypeLabel: Record<string, string> = {
  FX: "سعر صرف",
  Freight: "شحن",
  Supplier: "مورد",
  Quality: "جودة",
  Credit: "ائتمان/تحصيل",
  Compliance: "امتثال",
  Weather: "طقس",
  Political: "سياسي",
};

export default async function ScenarioDetailPage({
  params,
}: {
  params: Promise<{ id: string; scenarioId: string }>;
}) {
  const { id, scenarioId } = await params;
  const user = await requireCurrentUser();
  const orgId = user.orgId;
  const prisma = await getScopedPrisma();
  // ⚠️ نفس القيد المفروض في /deals/[id] و/deals/[id]/compare — لازم يتكرر هنا بالحرف، وإلا
  // بيبقى قابل للتجاوز بضغطة واحدة (اللينك من جدول السيناريوهات بيوصّل هنا مباشرة). الحقول
  // المحجوبة هنا بس الخمسة "قرار استراتيجي" (walkAwayPrice/breakEvenPrice/الربح/الهامش/الماركاپ)
  // — إجمالي التكاليف وبنود التكلفة/المخاطر الفردية فاضلة ظاهرة عمدًا لأنها بيانات إدخال تشغيلي
  // (SalesRep نفسه بيدخّلها) ومجاميع مشتقة من أرقام ظاهرة أصلًا، مش قرار حساس مستقل.
  const canSeeInternalPricing = (await getFieldAccess(user.roleId, "DealScenario", "walkAwayPrice")) !== "Hidden";
  // ⚠️ نفس فجوة IDOR في /deals/[id] و/deals/[id]/compare — اتكشف هنا كمان في إعادة مراجعة
  // وحدة 2 (7 سبتمبر). لازم يتفحص عبر deal.opportunity.ownerId لأن DealScenario ملهوش
  // ownerId مباشر.
  const dealViewScope = await getPermissionScope(user.roleId, "Deal", "View");
  const scopedOwnerId = await scopedOwnerIdFilter(dealViewScope, user);
  const ownerWhere = scopedOwnerId !== undefined ? { deal: { opportunity: { ownerId: scopedOwnerId } } } : {};

  const scenario = await prisma.dealScenario.findFirst({
    where: { id: scenarioId, orgId, dealId: id, ...ownerWhere },
    include: {
      costItems: { orderBy: { createdAt: "asc" }, include: { fxRate: true } },
      riskItems: { orderBy: { createdAt: "asc" } },
      fxRate: true,
    },
  });
  if (!scenario) notFound();

  // وحدة 5 — ملفات الامتثال المرتبطة بالسيناريو ده (لو موجودة). راجع docs/SCOPE-P5.md.
  const complianceCases = await prisma.complianceCase.findMany({
    where: { scenarioId: scenario.id },
    orderBy: { createdAt: "desc" },
  });

  // وحدة 7 — طلبات التوريد المرتبطة بالصفقة (مش بالسيناريو، راجع docs/SCOPE-P7.md).
  const sourcingRequests = await prisma.sourcingRequest.findMany({
    where: { dealId: id },
    orderBy: { createdAt: "desc" },
  });

  // وحدة 4 — مواصفات منتج الصفقة (لو موجودة)، لملء select "المواصفة" في فورم فتح طلب التوريد.
  const deal = await prisma.deal.findUniqueOrThrow({ where: { id }, select: { productId: true, marketId: true, customerId: true } });

  // ── مدخلات درجة الصفقة (مواصفة مشروع ٢ §٢٥) ────────────────────────────────
  // ⚠️ مش Promise.all — راجع BACKLOG.md (P2028).
  // المكوّن اللي مالوش بيانات هنا بيوصل `null` للمحرك، والمحرك بيشيله من الوزن
  // بدل ما يحط له قيمة محايدة تضلّل الدرجة. راجع src/lib/dealScoring.ts.
  const scoredProduct = await prisma.product.findUnique({ where: { id: deal.productId }, select: { status: true } });
  const openRedFlags = await prisma.redFlag.findMany({
    where: { orgId, companyId: deal.customerId, resolvedAt: null },
    select: { severity: true },
  });
  // أداء المورّد بييجي من أمر شراء مرتبط بطلب توريد للصفقة دي — أقرب رابط حقيقي
  // بين الصفقة والمورّد. لو مفيش، المكوّن بيتشال من الوزن.
  const dealPurchaseOrder = await prisma.purchaseOrder.findFirst({
    where: { orgId, sourcingRequest: { dealId: id } },
    select: { supplierId: true },
    orderBy: { createdAt: "desc" },
  });
  const supplierPerformance = dealPurchaseOrder
    ? await prisma.supplierPerformance.findFirst({
        where: { orgId, supplierId: dealPurchaseOrder.supplierId },
        select: { overallScore: true },
        orderBy: { createdAt: "desc" },
      })
    : null;
  const specifications = await prisma.productSpecification.findMany({
    where: { orgId, productId: deal.productId },
    select: { id: true, version: true, status: true },
    orderBy: { version: "desc" },
  });

  // وحدة 5 — مورّدين org-wide، لملء select "المورّد" الاختياري في فورم فتح ملف الامتثال (backfill).
  const suppliers = await prisma.supplier.findMany({
    where: { orgId },
    select: { id: true, legalName: true },
    orderBy: { legalName: "asc" },
  });

  // بند بعملة مختلفة عن السيناريو بيتحوّل قبل الجمع — نفس منطق recomputeScenario() بالظبط
  // (راجع src/app/deals/actions.ts)، مكرّر هنا لأن الصفحة دي عرض بس مش كتابة.
  const totalCost = scenario.costItems.reduce((sum, item) => {
    const amountInScenarioCurrency =
      item.currency === scenario.currency || !item.fxRate ? Number(item.amount) : Number(item.amount) * Number(item.fxRate.rate);
    return sum + amountInScenarioCurrency;
  }, 0);
  const totalRiskCost = scenario.riskItems.reduce((sum, item) => sum + Number(item.expectedCost), 0);

  // استغلال الحاوية بيتحسب تحت من حاويات فعلية سابقة؛ لو مفيش تاريخ بيفضل null
  // والمكوّن بيتشال من وزن الدرجة (مش بيتحط له رقم قياسي مفترض).
  const dealScoreResult = computeDealScore({
    expectedMarginPct: scenario.expectedMarginPct === null ? null : Number(scenario.expectedMarginPct),
    costConfidence: computeCostConfidenceScore(scenario.costItems),
    productStatus: scoredProduct?.status ?? null,
    openRedFlagSeverities: openRedFlags.map((f) => f.severity),
    advanceRatePct: scenario.advanceRatePct === null ? null : Number(scenario.advanceRatePct),
    creditDays: scenario.creditDays,
    supplierOverallScore: supplierPerformance?.overallScore == null ? null : Number(supplierPerformance.overallScore),
    containerUtilizationPct: null,
  });

  // وحدة 6 — اقتصاديات الكونتينر: عدد الحاويات الحقيقي اللي محتاجينه لكمية السيناريو دي، وتكلفة
  // الشحن الحقيقية من عروض أسعار مسجَّلة فعليًا. سعة كل نوع حاوية (avgMaxPayload) بتتحسب من
  // متوسط Container.maxPayload لحاويات فعلية سابقة في المنظمة دي — مش رقم قياسي مُخمَّن من
  // الإنترنت، لأن السعة الفعلية بتختلف باختلاف الشركة الناقلة والحاوية بالظبط (نفس مبدأ "ممنوع
  // تلفيق بيانات" اللي اتطبّق على التقويم الموسمي في تحليل الأسواق).
  const canViewContainerStats = (await getPermissionScope(user.roleId, "Shipment", "View")) !== null;
  // ⚠️ لازم Route.View وFreightQuote.View مع بعض — نفس التحذير المكرَّر في /logistics/routes/[id]:
  // القسم ده بيعرض بيانات Route (الموانئ/شركة الشحن) مش بس FreightQuote، فمفيش ضمان إن دور جديد
  // بعدين هيدّي الاتنين مع بعض دايمًا.
  const canViewFreightQuotes =
    (await getPermissionScope(user.roleId, "Route", "View")) !== null &&
    (await getPermissionScope(user.roleId, "FreightQuote", "View")) !== null;

  let market: { countryNameAr: string; mainPorts: string[] } | null = null;
  let containerStats: { containerType: string; avgMaxPayload: number; sampleSize: number }[] = [];
  let freightOptions: { containerType: string; currency: string; totalPerContainer: number; routeLabel: string; provider: string }[] = [];

  if (canViewContainerStats || canViewFreightQuotes) {
    market = await prisma.market.findUnique({ where: { id: deal.marketId }, select: { countryNameAr: true, mainPorts: true } });

    if (canViewContainerStats) {
      const grouped = await prisma.container.groupBy({
        by: ["containerType"],
        where: { orgId, maxPayload: { not: null } },
        _avg: { maxPayload: true },
        _count: { _all: true },
      });
      containerStats = grouped.map((g) => ({
        containerType: g.containerType,
        avgMaxPayload: Number(g._avg.maxPayload ?? 0),
        sampleSize: g._count._all,
      }));
    }

    if (canViewFreightQuotes && market) {
      const mainPorts = market.mainPorts;
      const portsMatch = (a: string, b: string) => {
        const x = a.trim().toLowerCase();
        const y = b.trim().toLowerCase();
        return x.length > 0 && y.length > 0 && (x === y || x.includes(y) || y.includes(x));
      };
      const routes = await prisma.route.findMany({
        where: { orgId },
        include: { freightQuotes: { where: { status: "Approved" }, include: { provider: true } } },
      });
      const matchingRoutes = routes.filter((r) => mainPorts.some((p) => portsMatch(r.destinationPort, p)));
      const quoteCost = (q: { originCharges: unknown; mainFreight: unknown; destinationCharges: unknown; insurance: unknown }) => {
        const n = (v: unknown) => (v === null || v === undefined ? 0 : Number(v));
        return n(q.originCharges) + n(q.mainFreight) + n(q.destinationCharges) + n(q.insurance);
      };
      const cheapest = new Map<string, { containerType: string; currency: string; totalPerContainer: number; routeLabel: string; provider: string }>();
      for (const route of matchingRoutes) {
        for (const q of route.freightQuotes) {
          if (!q.containerType || !q.currency) continue;
          const currency = q.currency.trim().toUpperCase();
          const key = `${q.containerType}:${currency}`;
          const cost = quoteCost(q);
          const current = cheapest.get(key);
          if (!current || cost < current.totalPerContainer) {
            cheapest.set(key, {
              containerType: q.containerType,
              currency,
              totalPerContainer: cost,
              routeLabel: `${route.originPort} ← ${route.destinationPort}`,
              provider: q.provider.name,
            });
          }
        }
      }
      freightOptions = Array.from(cheapest.values());
    }
  }

  const quantitySaleableNum = Number(scenario.quantitySaleable);
  const containerRows = freightOptions.map((f) => {
    const stats = containerStats.find((c) => c.containerType === f.containerType);
    const containersNeeded = stats && stats.avgMaxPayload > 0 ? Math.ceil(quantitySaleableNum / stats.avgMaxPayload) : null;
    const totalFreightCost = containersNeeded ? containersNeeded * f.totalPerContainer : null;
    const costPerKg = totalFreightCost && quantitySaleableNum > 0 ? totalFreightCost / quantitySaleableNum : null;
    const utilizationPct = containersNeeded && stats ? (quantitySaleableNum / (containersNeeded * stats.avgMaxPayload)) * 100 : null;
    return { ...f, stats, containersNeeded, totalFreightCost, costPerKg, utilizationPct };
  });
  const payloadOnlyStats = containerStats.filter((c) => !freightOptions.some((f) => f.containerType === c.containerType));

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <Button nativeButton={false} variant="link" className="px-0" render={<Link href={`/deals/${id}`}>← رجوع للصفقة</Link>} />

      <div className="mt-3 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-foreground">
          {scenario.scenarioName} (نسخة {scenario.version})
        </h1>
        {scenario.isLocked ? (
          <Button nativeButton={false} render={<Link href={`/deals/${id}/quotes/new?scenarioId=${scenario.id}`}>أنشئ عرض سعر</Link>} />
        ) : (
          <LockButton scenarioId={scenario.id} disabled={scenario.costItems.length === 0} lockVersion={scenario.lockVersion} />
        )}
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardContent>
            <p className="text-xs text-muted-foreground">الكمية القابلة للبيع</p>
            <p className="mt-1 font-mono text-lg text-foreground">{scenario.quantitySaleable.toString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-xs text-muted-foreground">إجمالي التكاليف</p>
            <p className="mt-1 font-mono text-lg text-foreground">
              {totalCost.toFixed(2)} {scenario.currency}
            </p>
          </CardContent>
        </Card>
        {canSeeInternalPricing && (
          <Card>
            <CardContent>
              <p className="text-xs text-muted-foreground">نقطة التعادل</p>
              <p className="mt-1 font-mono text-lg text-foreground">
                {scenario.breakEvenPrice ? `${scenario.breakEvenPrice.toString()} ${scenario.currency}` : "—"}
              </p>
            </CardContent>
          </Card>
        )}
        {canSeeInternalPricing && (
          <Card className="border-rose-200 bg-rose-50">
            <CardContent>
              <p className="text-xs text-rose-700">الحد الأدنى للسعر</p>
              <p className="mt-1 font-mono text-lg text-rose-900">
                {scenario.walkAwayPrice.toString()} {scenario.currency}
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="mt-4 rounded-xl border border-border bg-card px-4 py-3 text-sm">
        <p className="text-xs text-muted-foreground">الامتثال والجمارك</p>
        {complianceCases.length === 0 ? (
          <div className="mt-2">
            <OpenComplianceCaseForm dealId={id} scenarioId={scenario.id} suppliers={suppliers} />
          </div>
        ) : (
          <div className="mt-2 flex flex-wrap gap-2">
            {complianceCases.map((c) => (
              <Button
                key={c.id}
                nativeButton={false}
                variant="outline"
                size="sm"
                render={<Link href={`/compliance/${c.id}`}>ملف الامتثال ({complianceCaseStatusLabel[c.status]}) →</Link>}
              />
            ))}
          </div>
        )}
      </div>

      <div className="mt-4 rounded-xl border border-border bg-card px-4 py-3 text-sm">
        <p className="text-xs text-muted-foreground">التوريد</p>
        {sourcingRequests.length === 0 ? (
          <div className="mt-2">
            <OpenSourcingRequestForm dealId={id} currency={scenario.currency} specifications={specifications} />
          </div>
        ) : (
          <div className="mt-2 flex flex-wrap gap-2">
            {sourcingRequests.map((r) => (
              <Button
                key={r.id}
                nativeButton={false}
                variant="outline"
                size="sm"
                render={<Link href={`/sourcing/${r.id}`}>طلب توريد ({sourcingRequestStatusLabel[r.status]}) →</Link>}
              />
            ))}
          </div>
        )}
      </div>

      {scenario.finalPrice && canSeeInternalPricing && (
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="border-emerald-200 bg-emerald-50">
            <CardContent>
              <p className="text-xs text-emerald-700">الربح المتوقع</p>
              <p className="mt-1 font-mono text-lg text-emerald-900">
                {scenario.expectedProfit?.toString() ?? "—"} {scenario.currency}
              </p>
            </CardContent>
          </Card>
          <Card className="border-emerald-200 bg-emerald-50">
            <CardContent>
              <p className="text-xs text-emerald-700">هامش الربح %</p>
              <p className="mt-1 font-mono text-lg text-emerald-900">
                {scenario.expectedMarginPct ? `${Number(scenario.expectedMarginPct).toFixed(1)}%` : "—"}
              </p>
            </CardContent>
          </Card>
          <Card className="border-emerald-200 bg-emerald-50">
            <CardContent>
              <p className="text-xs text-emerald-700">نسبة الماركاپ %</p>
              <p className="mt-1 font-mono text-lg text-emerald-900">
                {scenario.expectedMarkupPct ? `${Number(scenario.expectedMarkupPct).toFixed(1)}%` : "—"}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {(scenario.paymentTerms || scenario.advanceRatePct || scenario.creditDays) && (
        <div className="mt-4 rounded-xl border border-border bg-card px-4 py-3 text-sm">
          <p className="text-xs text-muted-foreground">شروط الدفع</p>
          <p className="mt-1 text-foreground">
            {scenario.paymentTerms ?? "—"}
            {scenario.advanceRatePct ? ` · مقدّم ${Number(scenario.advanceRatePct).toFixed(0)}%` : ""}
            {scenario.creditDays ? ` · ${scenario.creditDays} يوم ائتمان` : ""}
          </p>
        </div>
      )}

      {!scenario.isLocked && (
        <section className="mt-6">
          <FinalPriceForm
            scenarioId={scenario.id}
            currency={scenario.currency}
            currentValue={scenario.finalPrice?.toString()}
            lockVersion={scenario.lockVersion}
          />
        </section>
      )}

      {canSeeInternalPricing && (
        <section className="mt-6">
          <DealScoreCard result={dealScoreResult} />
        </section>
      )}

      <section className="mt-8">
        <h2 className="text-lg font-medium text-foreground">بنود التكلفة</h2>
        <Card className="mt-3">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>البند</TableHead>
                  <TableHead>تفصيل</TableHead>
                  <TableHead>المبلغ</TableHead>
                  <TableHead>درجة الثقة</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {scenario.costItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-6 text-center text-muted-foreground">
                      لسه مفيش بنود تكلفة.
                    </TableCell>
                  </TableRow>
                ) : (
                  scenario.costItems.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>{categoryLabel[c.category]}</TableCell>
                      <TableCell>{c.subcategory ?? "—"}</TableCell>
                      <TableCell className="font-mono">
                        {c.amount.toString()} {c.currency}
                        {c.currency !== scenario.currency && c.fxRate && (
                          <span className="ms-1 text-xs text-muted-foreground">
                            (≈ {c.amount.mul(c.fxRate.rate).toFixed(2)} {scenario.currency})
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{c.confidenceLevel}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {!scenario.isLocked && (
          <div className="mt-4">
            <CostItemForm scenarioId={scenario.id} scenarioCurrency={scenario.currency} />
          </div>
        )}
      </section>

      {(canViewContainerStats || canViewFreightQuotes) && (
        <section className="mt-8">
          <h2 className="text-lg font-medium text-foreground">🧮 اقتصاديات الكونتينر</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            سعة كل نوع حاوية محسوبة من متوسط حاويات فعلية سابقة في شحناتكم ({market?.countryNameAr ? `المسار لموانئ ${market.countryNameAr}` : "كل الموانئ"}) —
            مش رقم قياسي مفترض من الإنترنت، لأن السعة الفعلية بتختلف حسب الشركة الناقلة. الأرقام هنا للمقارنة والتقدير — انسخ الرقم اللي تختاره يدويًا لبند &quot;شحن دولي&quot; فوق بعد ما تراجعه.
          </p>

          {containerRows.length === 0 && payloadOnlyStats.length === 0 ? (
            <div className="mt-3 rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
              لسه مفيش عروض أسعار شحن معتمدة لموانئ هذا السوق و/أو مفيش حاويات فعلية سابقة مسجَّلة بوزن أقصى — التقدير محتاج{" "}
              <Link href="/logistics/quotes" className="text-primary hover:underline">عرض سعر</Link> و/أو{" "}
              <Link href="/logistics" className="text-primary hover:underline">شحنة فعلية سابقة</Link> فيها بيانات حاوية.
            </div>
          ) : (
            <>
              {containerRows.length > 0 && (
                <div className="mt-3 overflow-x-auto rounded-xl border border-border bg-card">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>نوع الحاوية</TableHead>
                        <TableHead>خط الشحن (أرخص عرض)</TableHead>
                        <TableHead>تكلفة الحاوية الواحدة</TableHead>
                        <TableHead>سعة فعلية متوسطة</TableHead>
                        <TableHead>عدد الحاويات المطلوب</TableHead>
                        <TableHead>إجمالي تكلفة الشحن</TableHead>
                        <TableHead>التكلفة/كجم</TableHead>
                        <TableHead>نسبة الاستخدام</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {containerRows.map((r) => (
                        <TableRow key={`${r.containerType}:${r.currency}`}>
                          <TableCell>{containerTypeLabel[r.containerType] ?? r.containerType}</TableCell>
                          <TableCell className="text-foreground/80">
                            {r.provider} <span className="text-xs text-muted-foreground">({r.routeLabel})</span>
                          </TableCell>
                          <TableCell className="font-mono text-foreground/80">
                            {r.totalPerContainer.toLocaleString()} {r.currency}
                          </TableCell>
                          <TableCell className="font-mono text-foreground/80">
                            {r.stats ? `${r.stats.avgMaxPayload.toLocaleString()} كجم (${r.stats.sampleSize} حاوية سابقة)` : "غير معروف"}
                          </TableCell>
                          <TableCell className="font-mono text-foreground/80">{r.containersNeeded ?? "—"}</TableCell>
                          <TableCell className="font-mono font-medium text-foreground">
                            {r.totalFreightCost ? `${r.totalFreightCost.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${r.currency}` : "—"}
                          </TableCell>
                          <TableCell className="font-mono text-foreground/80">
                            {r.costPerKg ? `${r.costPerKg.toFixed(4)} ${r.currency}` : "—"}
                          </TableCell>
                          <TableCell className="font-mono text-foreground/80">
                            {r.utilizationPct ? `${r.utilizationPct.toFixed(0)}%` : "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {payloadOnlyStats.length > 0 && (
                <p className="mt-2 text-xs text-muted-foreground">
                  سعة فعلية معروفة بلا عرض سعر مطابق لموانئ هذا السوق:{" "}
                  {payloadOnlyStats
                    .map((s) => `${containerTypeLabel[s.containerType] ?? s.containerType} (${s.avgMaxPayload.toLocaleString()} كجم من ${s.sampleSize} حاوية سابقة)`)
                    .join("، ")}
                </p>
              )}
            </>
          )}
        </section>
      )}

      <section className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium text-foreground">بنود المخاطر</h2>
          {scenario.riskItems.length > 0 && (
            <p className="text-sm text-muted-foreground">
              إجمالي التكلفة المتوقعة للمخاطر:{" "}
              <span className="font-mono font-medium text-amber-700">
                {totalRiskCost.toFixed(2)} {scenario.currency}
              </span>
            </p>
          )}
        </div>
        <Card className="mt-3">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>النوع</TableHead>
                  <TableHead>الاحتمالية</TableHead>
                  <TableHead>الأثر المالي</TableHead>
                  <TableHead>التكلفة المتوقعة</TableHead>
                  <TableHead>التخفيف</TableHead>
                  <TableHead>المخاطرة المتبقية</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {scenario.riskItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-6 text-center text-muted-foreground">
                      لسه مفيش بنود مخاطر.
                    </TableCell>
                  </TableRow>
                ) : (
                  scenario.riskItems.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>{riskTypeLabel[r.riskType]}</TableCell>
                      <TableCell className="font-mono">{(Number(r.probability) * 100).toFixed(0)}%</TableCell>
                      <TableCell className="font-mono">
                        {r.financialImpact.toString()} {scenario.currency}
                      </TableCell>
                      <TableCell className="font-mono text-amber-700">
                        {r.expectedCost.toString()} {scenario.currency}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{r.mitigation ?? "—"}</TableCell>
                      <TableCell className="font-mono text-muted-foreground">
                        {r.residualRisk ? `${r.residualRisk.toString()} ${scenario.currency}` : "—"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {!scenario.isLocked && (
          <div className="mt-4">
            <RiskItemForm scenarioId={scenario.id} />
          </div>
        )}
      </section>
    </main>
  );
}
