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
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
  const deal = await prisma.deal.findUniqueOrThrow({ where: { id }, select: { productId: true } });
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
