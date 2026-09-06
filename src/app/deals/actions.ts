"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { getScopedPrisma, withScopedTransaction, type ScopedTx } from "@/lib/scoped-prisma";
import { requireCurrentUser } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import { requirePermission, assertOwnScope } from "@/lib/permissions";
import { getQuotePdfData } from "@/lib/quote-data";
import { renderQuotePdf } from "@/lib/quote-pdf";
import { isEmailConfigured, sendQuoteEmailMessage } from "@/lib/email";
import { uploadDocumentFile } from "@/lib/storage";
import { logError, isNextControlFlowError, businessRuleMessage } from "@/lib/errorLog";
import { postCommissionPayment } from "@/lib/accounting";

const DealSchema = z.object({
  opportunityId: z.string().uuid("اختر فرصة"),
  dealObjective: z.enum([
    "MaximizeProfit",
    "NewMarketEntry",
    "WinCustomer",
    "ProtectAccount",
    "ClearInventory",
    "TestMarket",
  ]),
});

export type DealFormState = { errors?: Record<string, string[]>; formError?: string };

export async function createDeal(
  _prevState: DealFormState,
  formData: FormData
): Promise<DealFormState> {
  const parsed = DealSchema.safeParse({
    opportunityId: formData.get("opportunityId"),
    dealObjective: formData.get("dealObjective"),
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const user = await requireCurrentUser();
  const scope = await requirePermission(user.roleId, "Deal", "Create");
  const scopedPrisma = await getScopedPrisma();

  const opportunity = await scopedPrisma.opportunity.findUnique({
    where: { id: parsed.data.opportunityId },
  });
  if (!opportunity) return { formError: "الفرصة غير موجودة." };
  await assertOwnScope(scope, opportunity.ownerId, user);

  let dealId: string;
  try {
    dealId = await withScopedTransaction(async (tx) => {
      const deal = await tx.deal.create({
        data: {
          orgId: user.orgId,
          opportunityId: opportunity.id,
          productId: opportunity.productId,
          marketId: opportunity.marketId,
          customerId: opportunity.companyId,
          dealObjective: parsed.data.dealObjective,
        },
      });
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "deal.created",
        entityType: "Deal",
        entityId: deal.id,
        afterValue: { opportunityId: opportunity.id, dealObjective: parsed.data.dealObjective },
      });
      return deal.id;
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "createDeal", error: e });
    return { formError: "حصل خطأ أثناء إنشاء الصفقة — حاول تاني." };
  }

  revalidatePath("/deals");
  redirect(`/deals/${dealId}`);
}

const ScenarioSchema = z.object({
  scenarioName: z.string().trim().min(1, "اسم السيناريو مطلوب"),
  quantityRaw: z.coerce.number().positive("الكمية لازم تكون أكبر من صفر"),
  yieldRate: z.coerce.number().positive().max(1).optional(),
  incoterm: z.enum(["EXW", "FCA", "FAS", "FOB", "CFR", "CIF", "CPT", "CIP", "DAP", "DPU", "DDP"]),
  namedPlace: z.string().trim().optional().or(z.literal("")),
  currency: z.string().trim().length(3, "لازم 3 حروف (ISO 4217)").toUpperCase(),
  walkAwayPrice: z.coerce.number().positive("الحد الأدنى للسعر مطلوب"),
  openingPrice: z.coerce.number().positive().optional(),
  targetPrice: z.coerce.number().positive().optional(),
  financeCost: z.coerce.number().nonnegative().optional(),
  riskReserve: z.coerce.number().nonnegative().optional(),
  // شروط الدفع — اختيارية، راجع BACKLOG.md § خلصان (30 أغسطس): كانت موجودة في الـschema بلا واجهة إدخال.
  paymentTerms: z.string().trim().optional().or(z.literal("")),
  advanceRatePct: z.coerce.number().min(0, "لازم بين 0 و100").max(100, "لازم بين 0 و100").optional(),
  creditDays: z.coerce.number().int().nonnegative("لازم يكون صفر أو أكبر").optional(),
});

export type ScenarioFormState = { errors?: Record<string, string[]>; formError?: string };

export async function createScenario(
  dealId: string,
  _prevState: ScenarioFormState,
  formData: FormData
): Promise<ScenarioFormState> {
  const parsed = ScenarioSchema.safeParse({
    scenarioName: formData.get("scenarioName"),
    quantityRaw: formData.get("quantityRaw"),
    yieldRate: formData.get("yieldRate") || undefined,
    incoterm: formData.get("incoterm"),
    namedPlace: formData.get("namedPlace") || undefined,
    currency: formData.get("currency"),
    walkAwayPrice: formData.get("walkAwayPrice"),
    openingPrice: formData.get("openingPrice") || undefined,
    targetPrice: formData.get("targetPrice") || undefined,
    financeCost: formData.get("financeCost") || undefined,
    riskReserve: formData.get("riskReserve") || undefined,
    paymentTerms: formData.get("paymentTerms") || undefined,
    advanceRatePct: formData.get("advanceRatePct") || undefined,
    creditDays: formData.get("creditDays") || undefined,
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const user = await requireCurrentUser();
  const scope = await requirePermission(user.roleId, "DealScenario", "Create");

  const { yieldRate, quantityRaw, namedPlace, targetPrice, financeCost, riskReserve, paymentTerms, ...rest } =
    parsed.data;
  const quantitySaleable = quantityRaw * (yieldRate ?? 1);

  try {
    await withScopedTransaction(async (tx) => {
      const deal = await tx.deal.findUnique({
        where: { id: dealId },
        include: { opportunity: { select: { ownerId: true } } },
      });
      if (!deal) throw new Error("الصفقة غير موجودة.");
      await assertOwnScope(scope, deal.opportunity.ownerId, user);

      // DealScenario.fxRateId إلزامي في الـschema (كان مُتصوَّر أصلًا لعملة تحويل حقيقية)، لكن
      // v1 مابيدعمش عملة أساس منفصلة عن عملة السيناريو نفسها — التحويل الحقيقي الوحيد المطبَّق
      // فعليًا هو على مستوى CostItem (راجع STATUS.md § آلية سعر الصرف). كان الفورم قبل كده بيطلب
      // من المستخدم يكتب "سعر صرف" العملة مقابل نفسها يدويًا، وهو رقم بلا معنى فعلي (لازم يساوي
      // 1 رياضيًا) — اتشال حقل الإدخال، وبنسجّل rate=1 تلقائيًا هنا عشان نحترم قيد الـschema
      // من غير ما نحمّل المستخدم إدخال بيانات وهمية. راجع BACKLOG.md § خلصان (30 أغسطس).
      const exchangeRate = await tx.exchangeRate.create({
        data: {
          orgId: user.orgId,
          baseCurrency: rest.currency,
          quoteCurrency: rest.currency,
          rate: 1,
          rateDate: new Date(),
          rateType: "Spot",
        },
      });

      const lastVersion = await tx.dealScenario.findFirst({
        where: { dealId },
        orderBy: { version: "desc" },
        select: { version: true },
      });

      const scenario = await tx.dealScenario.create({
        data: {
          orgId: user.orgId,
          dealId,
          version: (lastVersion?.version ?? 0) + 1,
          quantityRaw,
          yieldRate,
          quantitySaleable,
          namedPlace: namedPlace || undefined,
          targetPrice,
          financeCost,
          riskReserve,
          paymentTerms: paymentTerms || undefined,
          fxRateId: exchangeRate.id,
          ...rest,
        },
      });
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "dealScenario.created",
        entityType: "DealScenario",
        entityId: scenario.id,
        afterValue: { dealId, walkAwayPrice: rest.walkAwayPrice, currency: rest.currency },
      });

      if (deal.status === "Draft") {
        await tx.deal.update({ where: { id: dealId }, data: { status: "Pricing" } });
      }
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    if (e instanceof Error && e.message === "الصفقة غير موجودة.") return { formError: e.message };
    await logError({ orgId: user.orgId, userId: user.id, action: "createScenario", error: e });
    return { formError: "حصل خطأ أثناء إنشاء السيناريو — حاول تاني." };
  }

  revalidatePath(`/deals/${dealId}`);
  redirect(`/deals/${dealId}`);
}

const CostItemSchema = z.object({
  category: z.enum([
    "Product",
    "Processing",
    "Packaging",
    "Quality",
    "ExportLogistics",
    "InternationalFreight",
    "DestinationCharges",
    "SellingAdmin",
    "Finance",
    "RiskReserve",
  ]),
  subcategory: z.string().trim().optional().or(z.literal("")),
  amount: z.coerce.number().positive("المبلغ لازم يكون أكبر من صفر"),
  currency: z.string().trim().length(3, "العملة لازم تكون 3 حروف (زي USD)").toUpperCase(),
  // لازم بس لو currency مختلفة عن عملة السيناريو — بيتحقق منه يدويًا تحت (مش هنا) لأن
  // Zod مش عارف عملة السيناريو وقت التحقق.
  fxRate: z.coerce.number().positive("سعر الصرف لازم يكون أكبر من صفر").optional(),
  confidenceLevel: z.enum([
    "Contract100",
    "OfficialQuote90",
    "ExpiringQuote75",
    "HistoricalAvg60",
    "InternalEstimate40",
    "Assumption20",
  ]),
});

export type CostItemFormState = { errors?: Record<string, string[]>; formError?: string };

/** بيعيد حساب breakEvenPrice/expectedProfit/expectedMarginPct/expectedMarkupPct — v1 بيحسبهم هنا
 * بدل DB Generated Column (PG17.6، راجع docs/SCOPE-P2.md §4.1). */
async function recomputeScenario(
  prisma: Awaited<ReturnType<typeof getScopedPrisma>> | ScopedTx,
  scenarioId: string
) {
  const scenario = await prisma.dealScenario.findUniqueOrThrow({ where: { id: scenarioId } });
  const costItems = await prisma.costItem.findMany({ where: { scenarioId }, include: { fxRate: true } });
  // آلية سعر الصرف الحقيقية: بند تكلفة بعملة مختلفة عن السيناريو بيتحوّل لعملة السيناريو
  // بـfxRate.rate بتاعه قبل الجمع — راجع STATUS.md § آلية سعر الصرف. بند بعملة السيناريو
  // نفسها (الحالة الشائعة) بيتجمع زي ما هو من غير أي تحويل.
  const totalCost = costItems.reduce((sum, item) => {
    const amountInScenarioCurrency =
      item.currency === scenario.currency || !item.fxRate ? item.amount : item.amount.mul(item.fxRate.rate);
    return sum.add(amountInScenarioCurrency);
  }, new Prisma.Decimal(0));
  const quantitySaleable = scenario.quantitySaleable;
  const breakEvenPrice = quantitySaleable.greaterThan(0) ? totalCost.div(quantitySaleable) : null;

  let expectedProfit: Prisma.Decimal | null = null;
  let expectedMarginPct: Prisma.Decimal | null = null;
  let expectedMarkupPct: Prisma.Decimal | null = null;

  if (scenario.finalPrice && breakEvenPrice) {
    const marginPerUnit = scenario.finalPrice.sub(breakEvenPrice);
    expectedProfit = marginPerUnit.mul(quantitySaleable);
    expectedMarginPct = scenario.finalPrice.greaterThan(0)
      ? marginPerUnit.div(scenario.finalPrice).mul(100)
      : null;
    expectedMarkupPct = breakEvenPrice.greaterThan(0)
      ? marginPerUnit.div(breakEvenPrice).mul(100)
      : null;
  }

  // بلا فحص lockVersion هنا عمدًا — ده إعادة حساب من الحقيقة الحالية في القاعدة (كل بنود
  // التكلفة الموجودة فعليًا)، مش تطبيق تعديل بناءً على snapshot قديم فاتحه المستخدم زي
  // setFinalPrice/lockScenario. مفيش نية مستخدم ممكن تتفقد هنا، فمفيش داعي نرفض الكتابة —
  // لكن لازم نزوّد lockVersion برضو عشان أي فورم تاني فاتح نفس السيناريو يلاحظ إن حاجة اتغيّرت.
  await prisma.dealScenario.update({
    where: { id: scenarioId },
    data: { breakEvenPrice, expectedProfit, expectedMarginPct, expectedMarkupPct, lockVersion: { increment: 1 } },
  });
}

export async function createCostItem(
  scenarioId: string,
  _prevState: CostItemFormState,
  formData: FormData
): Promise<CostItemFormState> {
  const parsed = CostItemSchema.safeParse({
    category: formData.get("category"),
    subcategory: formData.get("subcategory") || undefined,
    amount: formData.get("amount"),
    currency: formData.get("currency"),
    fxRate: formData.get("fxRate") || undefined,
    confidenceLevel: formData.get("confidenceLevel"),
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const user = await requireCurrentUser();
  const scope = await requirePermission(user.roleId, "CostItem", "Create");

  const scopedPrisma = await getScopedPrisma();
  const scenario = await scopedPrisma.dealScenario.findUnique({
    where: { id: scenarioId },
    include: { deal: { include: { opportunity: { select: { ownerId: true } } } } },
  });
  if (!scenario) return { formError: "السيناريو غير موجود." };
  if (scenario.isLocked) return { formError: "السيناريو مقفول — مينفعش تضيف بنود تكلفة عليه." };
  await assertOwnScope(scope, scenario.deal.opportunity.ownerId, user);

  const { subcategory, fxRate, ...rest } = parsed.data;
  const needsFxRate = rest.currency !== scenario.currency;
  if (needsFxRate && !fxRate) {
    return {
      errors: {
        fxRate: [`العملة دي مختلفة عن عملة السيناريو (${scenario.currency}) — لازم تدخل سعر الصرف.`],
      },
    };
  }

  try {
    await withScopedTransaction(async (tx) => {
      // إعادة تحقّق من isLocked جوه الـtransaction نفسها — مش نفس الفحص الأول اللي قبل الـtransaction
      // (ده كان ممكن يبقى قديم لو حد قفل السيناريو في اللحظة بين القراءة الأولى وهنا). مفيش داعي
      // لـOptimistic Locking كامل هنا (CostItem صف جديد بيتضاف، مش تعديل بيكسر بيانات حد تاني)،
      // بس القفل نفسه لازم يتفحص من غير ما يبقى فيه ثغرة توقيت. راجع STATUS.md § Optimistic Locking.
      const fresh = await tx.dealScenario.findUniqueOrThrow({ where: { id: scenarioId } });
      if (fresh.isLocked) throw new Error("السيناريو اتقفل من مستخدم تاني — مينفعش تضيف بند تكلفة عليه.");

      let fxRateId: string | undefined;
      if (needsFxRate && fxRate) {
        const exchangeRate = await tx.exchangeRate.create({
          data: {
            orgId: user.orgId,
            baseCurrency: rest.currency,
            quoteCurrency: scenario.currency,
            rate: fxRate,
            rateDate: new Date(),
            rateType: "Spot",
          },
        });
        fxRateId = exchangeRate.id;
      }

      const costItem = await tx.costItem.create({
        data: { orgId: user.orgId, scenarioId, subcategory: subcategory || undefined, fxRateId, ...rest },
      });
      await recomputeScenario(tx, scenarioId);
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "costItem.created",
        entityType: "CostItem",
        entityId: costItem.id,
        afterValue: { scenarioId, ...rest, fxRate: fxRate ?? null },
      });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    if (e instanceof Error && e.message.includes("اتقفل من مستخدم تاني")) return { formError: e.message };
    await logError({ orgId: user.orgId, userId: user.id, action: "createCostItem", error: e });
    return { formError: "حصل خطأ أثناء إضافة بند التكلفة — حاول تاني." };
  }

  revalidatePath(`/deals/${scenario.dealId}/scenarios/${scenarioId}`);
  return {};
}

const RiskItemSchema = z.object({
  riskType: z.enum(["FX", "Freight", "Supplier", "Quality", "Credit", "Compliance", "Weather", "Political"]),
  probability: z.coerce.number().min(0, "لازم بين 0 و1").max(1, "لازم بين 0 و1"),
  financialImpact: z.coerce.number().positive("الأثر المالي لازم يكون أكبر من صفر"),
  mitigation: z.string().trim().optional().or(z.literal("")),
  // بعد التخفيف — إدخال يدوي اختياري، راجع docs/SCOPE-P2.md §خارج النطاق و BACKLOG.md § خلصان (30 أغسطس).
  residualRisk: z.coerce.number().nonnegative("لازم يكون صفر أو أكبر").optional(),
});

export type RiskItemFormState = { errors?: Record<string, string[]>; formError?: string };

export async function createRiskItem(
  scenarioId: string,
  _prevState: RiskItemFormState,
  formData: FormData
): Promise<RiskItemFormState> {
  const parsed = RiskItemSchema.safeParse({
    riskType: formData.get("riskType"),
    probability: formData.get("probability"),
    financialImpact: formData.get("financialImpact"),
    mitigation: formData.get("mitigation") || undefined,
    residualRisk: formData.get("residualRisk") || undefined,
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const user = await requireCurrentUser();
  const scope = await requirePermission(user.roleId, "RiskItem", "Create");

  const scopedPrisma = await getScopedPrisma();
  const scenario = await scopedPrisma.dealScenario.findUnique({
    where: { id: scenarioId },
    include: { deal: { include: { opportunity: { select: { ownerId: true } } } } },
  });
  if (!scenario) return { formError: "السيناريو غير موجود." };
  if (scenario.isLocked) return { formError: "السيناريو مقفول — مينفعش تضيف بنود مخاطر عليه." };
  await assertOwnScope(scope, scenario.deal.opportunity.ownerId, user);

  const { mitigation, probability, financialImpact, riskType, residualRisk } = parsed.data;
  const expectedCost = new Prisma.Decimal(probability).mul(financialImpact);

  try {
    await withScopedTransaction(async (tx) => {
      // نفس ملاحظة createCostItem — إعادة تحقّق من isLocked جوه الـtransaction عشان لو حد
      // قفل السيناريو في اللحظة بين القراءة الأولى وهنا.
      const fresh = await tx.dealScenario.findUniqueOrThrow({ where: { id: scenarioId } });
      if (fresh.isLocked) throw new Error("السيناريو اتقفل من مستخدم تاني — مينفعش تضيف بند مخاطرة عليه.");

      const riskItem = await tx.riskItem.create({
        data: {
          orgId: user.orgId,
          scenarioId,
          riskType,
          probability,
          financialImpact,
          expectedCost,
          mitigation: mitigation || undefined,
          residualRisk,
        },
      });
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "riskItem.created",
        entityType: "RiskItem",
        entityId: riskItem.id,
        afterValue: {
          scenarioId,
          riskType,
          probability,
          financialImpact,
          expectedCost: expectedCost.toString(),
          residualRisk: residualRisk ?? null,
        },
      });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    if (e instanceof Error && e.message.includes("اتقفل من مستخدم تاني")) return { formError: e.message };
    await logError({ orgId: user.orgId, userId: user.id, action: "createRiskItem", error: e });
    return { formError: "حصل خطأ أثناء إضافة بند المخاطرة — حاول تاني." };
  }

  revalidatePath(`/deals/${scenario.dealId}/scenarios/${scenarioId}`);
  revalidatePath(`/deals/${scenario.dealId}/compare`);
  return {};
}

/** بيترمي لو `lockVersion` اللي بعته الفورم مش نفس اللي في القاعدة دلوقتي — يعني حد تاني عدّل
 * السيناريو من ساعة ما فتحت الصفحة. راجع STATUS.md § Optimistic Locking. */
class StaleScenarioError extends Error {}

/**
 * تحديث محمي بـOptimistic Locking — بيحدّث بس لو `lockVersion` الحالي في القاعدة لسه زي اللي
 * الفورم شافه وقت تحميل الصفحة (`expectedLockVersion`)، وبيزوّده بواحد لو نجح. لو حد تاني عدّل
 * السيناريو في الوقت ده، الـ`updateMany` هترجع `count: 0` ونرمي `StaleScenarioError`.
 */
async function updateScenarioWithLock(
  tx: ScopedTx,
  scenarioId: string,
  expectedLockVersion: number,
  data: Prisma.DealScenarioUpdateManyMutationInput
) {
  const result = await tx.dealScenario.updateMany({
    where: { id: scenarioId, lockVersion: expectedLockVersion },
    data: { ...data, lockVersion: { increment: 1 } },
  });
  if (result.count === 0) {
    throw new StaleScenarioError(
      "السيناريو اتعدّل من مستخدم تاني من ساعة ما فتحت الصفحة — حدّث الصفحة وشوف آخر تحديث قبل ما تكمّل."
    );
  }
}

const FinalPriceSchema = z.object({
  finalPrice: z.coerce.number().positive("السعر النهائي لازم يكون أكبر من صفر"),
  expectedLockVersion: z.coerce.number().int(),
});

export type FinalPriceFormState = { errors?: Record<string, string[]>; formError?: string };

export async function setFinalPrice(
  scenarioId: string,
  _prevState: FinalPriceFormState,
  formData: FormData
): Promise<FinalPriceFormState> {
  const parsed = FinalPriceSchema.safeParse({
    finalPrice: formData.get("finalPrice"),
    expectedLockVersion: formData.get("expectedLockVersion"),
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const user = await requireCurrentUser();
  const scope = await requirePermission(user.roleId, "DealScenario", "Edit");

  const scopedPrisma = await getScopedPrisma();
  const scenario = await scopedPrisma.dealScenario.findUnique({
    where: { id: scenarioId },
    include: { deal: { include: { opportunity: { select: { ownerId: true } } } } },
  });
  if (!scenario) return { formError: "السيناريو غير موجود." };
  if (scenario.isLocked) return { formError: "السيناريو مقفول." };
  await assertOwnScope(scope, scenario.deal.opportunity.ownerId, user);

  try {
    await withScopedTransaction(async (tx) => {
      await updateScenarioWithLock(tx, scenarioId, parsed.data.expectedLockVersion, {
        finalPrice: parsed.data.finalPrice,
      });
      await recomputeScenario(tx, scenarioId);
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "dealScenario.finalPriceSet",
        entityType: "DealScenario",
        entityId: scenarioId,
        beforeValue: { finalPrice: scenario.finalPrice?.toString() ?? null },
        afterValue: { finalPrice: parsed.data.finalPrice },
      });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    if (e instanceof StaleScenarioError) return { formError: e.message };
    await logError({ orgId: user.orgId, userId: user.id, action: "setFinalPrice", error: e });
    throw e;
  }

  revalidatePath(`/deals/${scenario.dealId}/scenarios/${scenarioId}`);
  return {};
}

export type LockScenarioState = { formError?: string };

/**
 * ⚠️ ترجع {formError} بدل ما ترمي — Next.js بيسترد رسالة أي Error مرمي من Server Action
 * في production build (بيستبدلها بـ"An error occurred" + digest)، فرسائل عربي مفهومة
 * لازم تتوصّل كـ return value، مش throw، عشان تفضل ظاهرة برّه بيئة التطوير.
 */
export async function lockScenario(
  scenarioId: string,
  _prevState: LockScenarioState,
  formData: FormData
): Promise<LockScenarioState> {
  const user = await requireCurrentUser();
  const expectedLockVersion = Number(formData.get("expectedLockVersion"));

  try {
    const scope = await requirePermission(user.roleId, "DealScenario", "Edit");

    const dealId = await withScopedTransaction(async (tx) => {
      const scenario = await tx.dealScenario.findUniqueOrThrow({
        where: { id: scenarioId },
        include: { deal: { include: { opportunity: { select: { ownerId: true } } } } },
      });
      await assertOwnScope(scope, scenario.deal.opportunity.ownerId, user);

      const costItemCount = await tx.costItem.count({ where: { scenarioId } });
      if (costItemCount === 0) {
        throw new Error("السيناريو محتاج بند تكلفة واحد على الأقل قبل القفل.");
      }

      await updateScenarioWithLock(tx, scenarioId, expectedLockVersion, { isLocked: true });
      await tx.deal.update({ where: { id: scenario.dealId }, data: { activeScenarioId: scenarioId } });
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "dealScenario.locked",
        entityType: "DealScenario",
        entityId: scenarioId,
      });
      return scenario.dealId;
    });

    revalidatePath(`/deals/${dealId}/scenarios/${scenarioId}`);
    revalidatePath(`/deals/${dealId}`);
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    // ⚠️ عمدًا مش بنسجّل logError هنا — الرسالة الحقيقية بتتعرض للمستخدم مباشرة أصلًا (مش بلع صامت)،
    // وأغلب الحالات validation متوقعة (زي "محتاج بند تكلفة أول") مش باگ حقيقي يستاهل تسجيل.
    return { formError: e instanceof Error ? e.message : "حصل خطأ أثناء قفل السيناريو — حاول تاني." };
  }

  return {};
}

const QuoteSchema = z.object({
  unitPrice: z.coerce.number().positive("السعر مطلوب"),
  priceUnit: z.string().trim().min(1, "وحدة السعر مطلوبة (مثال: kg)"),
  validUntil: z.string().trim().optional().or(z.literal("")),
});

export type QuoteFormState = { errors?: Record<string, string[]>; formError?: string };

export async function createQuote(
  scenarioId: string,
  _prevState: QuoteFormState,
  formData: FormData
): Promise<QuoteFormState> {
  const parsed = QuoteSchema.safeParse({
    unitPrice: formData.get("unitPrice"),
    priceUnit: formData.get("priceUnit"),
    validUntil: formData.get("validUntil") || undefined,
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const user = await requireCurrentUser();
  const scope = await requirePermission(user.roleId, "Quote", "Create");

  const scopedPrisma = await getScopedPrisma();
  const scenario = await scopedPrisma.dealScenario.findUnique({
    where: { id: scenarioId },
    include: { deal: { include: { opportunity: { select: { ownerId: true } } } } },
  });
  if (!scenario) return { formError: "السيناريو غير موجود." };
  if (!scenario.isLocked) return { formError: "لازم تقفل السيناريو الأول قبل إنشاء عرض سعر منه." };
  await assertOwnScope(scope, scenario.deal.opportunity.ownerId, user);

  const belowWalkAway = new Prisma.Decimal(parsed.data.unitPrice).lessThan(scenario.walkAwayPrice);

  // السعر تحت الحد الأدنى — الـTrigger (enforce_quote_walk_away_price) هيمنع إنشاء الـQuote
  // مباشرة أيًا كان. المسار الوحيد: طلب موافقة استثنائية (راجع src/app/approvals).
  if (belowWalkAway) {
    const existingPending = await scopedPrisma.approval.findFirst({
      where: {
        orgId: user.orgId,
        subjectType: "Quote.unitPrice_override",
        decision: "Pending",
        payload: { path: ["scenarioId"], equals: scenarioId },
      },
    });
    if (existingPending) {
      return {
        formError: "في طلب موافقة استثنائية معلّق بالفعل لهذا السيناريو — استنى قرار المدير قبل ما تطلب تاني.",
      };
    }

    try {
      await withScopedTransaction(async (tx) => {
        const [{ id: reservedQuoteId }] = await tx.$queryRaw<{ id: string }[]>`SELECT uuidv7() AS id`;
        const approval = await tx.approval.create({
          data: {
            orgId: user.orgId,
            subjectType: "Quote.unitPrice_override",
            subjectId: reservedQuoteId,
            requestedBy: user.id,
            payload: {
              scenarioId,
              dealId: scenario.dealId,
              customerId: scenario.deal.customerId,
              currency: scenario.currency,
              incoterm: scenario.incoterm,
              namedPlace: scenario.namedPlace,
              unitPrice: parsed.data.unitPrice,
              priceUnit: parsed.data.priceUnit,
              validUntil: parsed.data.validUntil || null,
              walkAwayPrice: scenario.walkAwayPrice.toString(),
            },
          },
        });
        await logAudit(tx, {
          orgId: user.orgId,
          userId: user.id,
          action: "quote.approvalRequested",
          entityType: "Approval",
          entityId: approval.id,
          afterValue: { scenarioId, unitPrice: parsed.data.unitPrice, walkAwayPrice: scenario.walkAwayPrice.toString() },
        });
      });
    } catch (e) {
      if (isNextControlFlowError(e)) throw e;
      await logError({ orgId: user.orgId, userId: user.id, action: "requestQuoteApproval", error: e });
      return { formError: "حصل خطأ أثناء إرسال طلب الموافقة — حاول تاني." };
    }

    revalidatePath(`/deals/${scenario.dealId}`);
    redirect(`/deals/${scenario.dealId}`);
  }

  try {
    await withScopedTransaction(async (tx) => {
      const lastVersion = await tx.quote.findFirst({
        where: { dealId: scenario.dealId },
        orderBy: { version: "desc" },
        select: { version: true },
      });

      const quote = await tx.quote.create({
        data: {
          orgId: user.orgId,
          dealId: scenario.dealId,
          scenarioId,
          version: (lastVersion?.version ?? 0) + 1,
          customerId: scenario.deal.customerId,
          currency: scenario.currency,
          incoterm: scenario.incoterm,
          namedPlace: scenario.namedPlace,
          unitPrice: parsed.data.unitPrice,
          priceUnit: parsed.data.priceUnit,
          validUntil: parsed.data.validUntil ? new Date(parsed.data.validUntil) : undefined,
        },
      });
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "quote.created",
        entityType: "Quote",
        entityId: quote.id,
        afterValue: { scenarioId, unitPrice: parsed.data.unitPrice, priceUnit: parsed.data.priceUnit },
      });
      if (scenario.deal.status === "Draft" || scenario.deal.status === "Pricing") {
        await tx.deal.update({ where: { id: scenario.dealId }, data: { status: "Negotiation" } });
      }
    });
    revalidatePath(`/deals/${scenario.dealId}`);
    redirect(`/deals/${scenario.dealId}`);
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    if (e && typeof e === "object" && "message" in e && String(e.message).includes("walkAwayPrice")) {
      return {
        formError: "السعر ده أقل من الحد الأدنى المسموح (walkAwayPrice) — لازم موافقة استثنائية.",
      };
    }
    await logError({ orgId: user.orgId, userId: user.id, action: "createQuote", error: e });
    throw e;
  }
}

export type SendQuoteEmailState = { formError?: string; success?: boolean };

/**
 * بيبعت عرض السعر (PDF) لإيميل جهة الاتصال المرتبطة بالفرصة، وبيحدّث حالة الـQuote لـ"Sent".
 * الـPDF بيتولّد بنفس المسار المستخدم في route التحميل (`getQuotePdfData` + `renderQuotePdf`)
 * عشان مفيش ازدواجية في منطق التوليد. لو RESEND_API_KEY مش متظبط، بترجع رسالة واضحة بدل ما تكراش.
 */
export async function sendQuoteEmail(
  quoteId: string,
  _prevState: SendQuoteEmailState
): Promise<SendQuoteEmailState> {
  const user = await requireCurrentUser();
  const scope = await requirePermission(user.roleId, "Quote", "Create");

  if (!isEmailConfigured()) {
    return { formError: "خدمة الإيميل مش مفعّلة لسه — محتاج RESEND_API_KEY في إعدادات المنصة." };
  }

  const scopedPrisma = await getScopedPrisma();
  const quote = await scopedPrisma.quote.findFirst({
    where: { id: quoteId, orgId: user.orgId },
    include: { deal: { include: { opportunity: { select: { ownerId: true, contact: true } } } } },
  });
  if (!quote) return { formError: "عرض السعر غير موجود." };
  await assertOwnScope(scope, quote.deal.opportunity.ownerId, user);

  if (["Rejected", "Expired", "Superseded"].includes(quote.status)) {
    return { formError: "عرض السعر ده في حالة نهائية — مينفعش يتبعت." };
  }

  const contactEmail = quote.deal.opportunity.contact?.email;
  if (!contactEmail) {
    return { formError: "مفيش إيميل مسجّل لجهة الاتصال الخاصة بالفرصة — سجّله الأول." };
  }

  const pdfData = await getQuotePdfData(scopedPrisma, quoteId, user.orgId);
  if (!pdfData) return { formError: "عرض السعر غير موجود." };

  const pdfBuffer = await renderQuotePdf(pdfData);

  try {
    await sendQuoteEmailMessage({
      to: contactEmail,
      customerName: pdfData.customerLegalName,
      productNameAr: pdfData.productNameAr,
      quoteVersion: pdfData.version,
      pdfBuffer,
      pdfFilename: `quote-${pdfData.quoteId.slice(0, 8)}-v${pdfData.version}.pdf`,
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "sendQuoteEmail", error: e });
    return { formError: "فشل إرسال الإيميل — تأكد من إعدادات خدمة البريد وحاول تاني." };
  }

  await withScopedTransaction(async (tx) => {
    await tx.quote.update({ where: { id: quoteId }, data: { status: "Sent" } });
    await logAudit(tx, {
      orgId: user.orgId,
      userId: user.id,
      action: "quote.emailed",
      entityType: "Quote",
      entityId: quoteId,
      afterValue: { to: contactEmail },
    });
  });

  revalidatePath(`/deals/${quote.dealId}`);
  return { success: true };
}

/**
 * بيوثّق "Won" بدليل PO فعلي بدل مجرد تغيير حالة (ERD §5، 🆕v4) — بيقبل عرض السعر وينشئ SalesOrder مسودة.
 *
 * كل الكتابات دي (تحديث Quote + إنشاء SalesOrder + SalesOrderLine + تحديث Deal) لازم تنجح
 * أو تترجع مع بعض — عملية مالية واحدة، مش 5 عمليات مستقلة. بنستخدم `withScopedTransaction`
 * بدل `getScopedPrisma` العادي (اللي بيفتح transaction منفصلة لكل استعلام لوحده) عشان كده.
 *
 * بنقفل كمان بـ `pg_advisory_xact_lock` قبل حساب soNumber، عشان لو اتنين ضغطوا "اقبل العرض"
 * في نفس اللحظة بالظبط (نفس المنظمة، نفس السنة) محدش ياخد نفس الرقم — القفل بيتحرر تلقائيًا
 * لما الـtransaction تخلص (commit أو rollback).
 */
export async function acceptQuote(quoteId: string) {
  const user = await requireCurrentUser();
  const scope = await requirePermission(user.roleId, "Quote", "Approve");

  const { dealId } = await withScopedTransaction(async (tx) => {
    const quote = await tx.quote.findUniqueOrThrow({
      where: { id: quoteId },
      include: { scenario: true, deal: { include: { opportunity: { select: { ownerId: true } } } } },
    });
    await assertOwnScope(scope, quote.deal.opportunity.ownerId, user);
    if (quote.status === "Accepted" || quote.status === "Rejected") {
      throw new Error("العرض ده اتقفل بالفعل (مقبول أو مرفوض).");
    }

    const year = new Date().getFullYear();
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`so-number-${user.orgId}-${year}`}))`;

    const countThisYear = await tx.salesOrder.count({
      where: { orgId: user.orgId, soNumber: { startsWith: `SO-${year}-` } },
    });
    const soNumber = `SO-${year}-${String(countThisYear + 1).padStart(4, "0")}`;
    const totalValue = quote.unitPrice.mul(quote.scenario.quantitySaleable);

    await tx.quote.update({ where: { id: quoteId }, data: { status: "Accepted" } });

    const salesOrder = await tx.salesOrder.create({
      data: {
        orgId: user.orgId,
        dealId: quote.dealId,
        customerId: quote.customerId,
        soNumber,
        currency: quote.currency,
        totalValue,
        incoterm: quote.incoterm,
      },
    });

    await tx.salesOrderLine.create({
      data: {
        orgId: user.orgId,
        salesOrderId: salesOrder.id,
        productId: quote.deal.productId,
        quantity: quote.scenario.quantitySaleable,
        unitPrice: quote.unitPrice,
        currency: quote.currency,
      },
    });

    await tx.deal.update({ where: { id: quote.dealId }, data: { status: "Won" } });

    await logAudit(tx, {
      orgId: user.orgId,
      userId: user.id,
      action: "quote.accepted",
      entityType: "Quote",
      entityId: quoteId,
    });
    await logAudit(tx, {
      orgId: user.orgId,
      userId: user.id,
      action: "salesOrder.created",
      entityType: "SalesOrder",
      entityId: salesOrder.id,
      afterValue: { soNumber, totalValue: totalValue.toString() },
    });

    return { salesOrder, dealId: quote.dealId };
  });

  revalidatePath(`/deals/${dealId}`);
  revalidatePath("/deals");
}

const ConfirmSalesOrderSchema = z.object({
  poNumber: z.string().trim().min(1, "رقم أمر الشراء مطلوب"),
  poDate: z.string().trim().min(1, "تاريخ أمر الشراء مطلوب"),
});

export type ConfirmSalesOrderFormState = { errors?: Record<string, string[]>; formError?: string };

/** ⚠️ الحارس الحقيقي هو CHECK constraint على مستوى القاعدة (migration الـSalesOrder) — ده تحقق واجهة بس. */
export async function confirmSalesOrder(
  salesOrderId: string,
  _prevState: ConfirmSalesOrderFormState,
  formData: FormData
): Promise<ConfirmSalesOrderFormState> {
  const parsed = ConfirmSalesOrderSchema.safeParse({
    poNumber: formData.get("poNumber"),
    poDate: formData.get("poDate"),
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const user = await requireCurrentUser();
  const scope = await requirePermission(user.roleId, "SalesOrder", "Edit");

  const scopedPrisma = await getScopedPrisma();
  const salesOrder = await scopedPrisma.salesOrder.findUniqueOrThrow({
    where: { id: salesOrderId },
    include: { deal: { include: { opportunity: { select: { ownerId: true } } } } },
  });
  await assertOwnScope(scope, salesOrder.deal.opportunity.ownerId, user);
  if (salesOrder.status !== "Draft") return { formError: "أمر البيع ده اتأكد بالفعل." };

  try {
    await withScopedTransaction(async (tx) => {
      await tx.salesOrder.update({
        where: { id: salesOrderId },
        data: {
          poNumber: parsed.data.poNumber,
          poDate: new Date(parsed.data.poDate),
          status: "Confirmed",
        },
      });
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "salesOrder.confirmed",
        entityType: "SalesOrder",
        entityId: salesOrderId,
        afterValue: { poNumber: parsed.data.poNumber, poDate: parsed.data.poDate },
      });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "confirmSalesOrder", error: e });
    return { formError: "حصل خطأ أثناء تأكيد أمر البيع — حاول تاني." };
  }

  revalidatePath(`/deals/${salesOrder.dealId}`);
  return {};
}

const MarkDealLostSchema = z.object({
  lostReason: z.string().trim().min(3, "سبب الخسارة مطلوب"),
});

export type MarkDealLostFormState = { errors?: Record<string, string[]>; formError?: string };

export async function markDealLost(
  dealId: string,
  _prevState: MarkDealLostFormState,
  formData: FormData
): Promise<MarkDealLostFormState> {
  const parsed = MarkDealLostSchema.safeParse({ lostReason: formData.get("lostReason") });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const user = await requireCurrentUser();
  const scope = await requirePermission(user.roleId, "Deal", "Edit");

  await withScopedTransaction(async (tx) => {
    const deal = await tx.deal.findUniqueOrThrow({
      where: { id: dealId },
      include: { opportunity: { select: { ownerId: true } } },
    });
    await assertOwnScope(scope, deal.opportunity.ownerId, user);

    await tx.deal.update({
      where: { id: dealId },
      data: { status: "Lost", lostReason: parsed.data.lostReason },
    });

    await logAudit(tx, {
      orgId: user.orgId,
      userId: user.id,
      action: "deal.lost",
      entityType: "Deal",
      entityId: dealId,
      afterValue: { lostReason: parsed.data.lostReason },
    });
  });

  revalidatePath(`/deals/${dealId}`);
  revalidatePath("/deals");
  return {};
}

const DOCUMENT_TYPES = [
  "Quotation", "ProformaInvoice", "CommercialInvoice", "PackingList", "SalesContract", "SalesConfirmation", "TechnicalDataSheet", "COA", "Declaration", "PriceList", "EmailDraft",
] as const;
const DOCUMENT_LANGUAGES = ["Arabic", "English", "Bilingual"] as const;
const DOCUMENT_STATUSES = [
  "Draft", "Incomplete", "UnderReview", "RevisionRequired", "Approved", "Issued", "Sent", "Acknowledged", "Superseded", "Expired", "Cancelled",
] as const;
const DOCUMENT_ETA_STATUSES = ["NotApplicable", "Pending", "Submitted", "Validated", "Rejected"] as const;

const DocumentSchema = z.object({
  documentType: z.enum(DOCUMENT_TYPES),
  documentNumber: z.string().trim().min(1, "رقم المستند مطلوب"),
  version: z.coerce.number().int().positive().optional(),
  language: z.enum(DOCUMENT_LANGUAGES),
  status: z.enum(DOCUMENT_STATUSES),
  confidentiality: z.string().trim().optional().or(z.literal("")),
  expiryDate: z.string().trim().optional().or(z.literal("")),
  etaUuid: z.string().trim().optional().or(z.literal("")),
  etaStatus: z.enum(DOCUMENT_ETA_STATUSES),
  etaSubmittedAt: z.string().trim().optional().or(z.literal("")),
});

export type DocumentFormState = { errors?: Record<string, string[]>; formError?: string };

/** companyId/shipmentId/specificationId/approvalId بلا واجهة اختيار — الكيانات موجودة بس مفيش
 * داعي فورم اختيار لكل واحد دلوقتي (نفس نمط NCR.batchId/lotId). content/fileUrl بلا واجهة إدخال
 * (Supabase Storage/Signed URL لسه مش مبنية في المشروع). الـTrigger enforce_document_eta_validated
 * بيمنع status→Issued/Sent لـCommercialInvoice بلا etaStatus=Validated — قيد صلب بلا مسار تجاوز
 * (عكس PurchaseOrder.unitPrice_override)، فمفيش فرع موافقة استثنائية هنا. */
export async function createDocument(dealId: string, _prevState: DocumentFormState, formData: FormData): Promise<DocumentFormState> {
  const parsed = DocumentSchema.safeParse({
    documentType: formData.get("documentType"),
    documentNumber: formData.get("documentNumber"),
    version: formData.get("version") || undefined,
    language: formData.get("language"),
    status: formData.get("status"),
    confidentiality: formData.get("confidentiality") || undefined,
    expiryDate: formData.get("expiryDate") || undefined,
    etaUuid: formData.get("etaUuid") || undefined,
    etaStatus: formData.get("etaStatus"),
    etaSubmittedAt: formData.get("etaSubmittedAt") || undefined,
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const user = await requireCurrentUser();
  const scope = await requirePermission(user.roleId, "Document", "Create");
  const { confidentiality, expiryDate, etaUuid, etaSubmittedAt, ...rest } = parsed.data;

  const file = formData.get("file");
  const hasFile = file instanceof File && file.size > 0;

  try {
    const scopedPrisma = await getScopedPrisma();
    const deal = await scopedPrisma.deal.findUniqueOrThrow({
      where: { id: dealId },
      include: { opportunity: { select: { ownerId: true } } },
    });
    await assertOwnScope(scope, deal.opportunity.ownerId, user);

    const documentId = await withScopedTransaction(async (tx) => {
      const document = await tx.document.create({
        data: {
          orgId: user.orgId,
          dealId,
          confidentiality: confidentiality || undefined,
          expiryDate: expiryDate ? new Date(expiryDate) : undefined,
          etaUuid: etaUuid || undefined,
          etaSubmittedAt: etaSubmittedAt ? new Date(etaSubmittedAt) : undefined,
          ...rest,
        },
      });
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "document.created",
        entityType: "Document",
        entityId: document.id,
        afterValue: { dealId, ...rest },
      });
      return document.id;
    });

    // Storage مش transactional مع Postgres — الرفع بيحصل بعد تأكيد الصف، عبر scoped prisma لعزل RLS.
    if (hasFile) {
      const path = await uploadDocumentFile(user.orgId, dealId, documentId, file as File);
      await scopedPrisma.document.update({ where: { id: documentId }, data: { fileUrl: path } });
    }
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "createDocument", error: e });
    return { formError: "حصل خطأ أثناء إضافة المستند — حاول تاني (لو رقم المستند مكرّر، جرّب رقم مختلف)." };
  }

  revalidatePath(`/deals/${dealId}`);
  return {};
}

const DOCUMENT_PACKAGE_TYPES = ["QuotationPack", "FirstOrderPack", "ShipmentPack", "SamplePack", "TenderPack"] as const;
const DOCUMENT_PACKAGE_STATUSES = ["NotStarted", "InProgress", "MissingData", "UnderReview", "Complete", "Issued", "Sent"] as const;

const DocumentPackageSchema = z.object({
  packageType: z.enum(DOCUMENT_PACKAGE_TYPES),
  status: z.enum(DOCUMENT_PACKAGE_STATUSES),
});

export type DocumentPackageFormState = { errors?: Record<string, string[]>; formError?: string };

/** shipmentId بلا واجهة اختيار — نفس نمط Document.shipmentId بالحرف. completenessScore بلا واجهة
 * إدخال (عمود لمحرك حساب مستقبلي). */
export async function createDocumentPackage(dealId: string, _prevState: DocumentPackageFormState, formData: FormData): Promise<DocumentPackageFormState> {
  const parsed = DocumentPackageSchema.safeParse({
    packageType: formData.get("packageType"),
    status: formData.get("status"),
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const user = await requireCurrentUser();
  const scope = await requirePermission(user.roleId, "DocumentPackage", "Create");

  try {
    const scopedPrisma = await getScopedPrisma();
    const deal = await scopedPrisma.deal.findUniqueOrThrow({
      where: { id: dealId },
      include: { opportunity: { select: { ownerId: true } } },
    });
    await assertOwnScope(scope, deal.opportunity.ownerId, user);

    await withScopedTransaction(async (tx) => {
      const pkg = await tx.documentPackage.create({
        data: { orgId: user.orgId, dealId, ...parsed.data },
      });
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "documentPackage.created",
        entityType: "DocumentPackage",
        entityId: pkg.id,
        afterValue: { dealId, ...parsed.data },
      });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "createDocumentPackage", error: e });
    return { formError: "حصل خطأ أثناء إضافة حزمة المستندات — حاول تاني." };
  }

  revalidatePath(`/deals/${dealId}`);
  return {};
}

const DocumentVersionSchema = z.object({
  documentId: z.string().uuid("اختر مستند"),
  versionNumber: z.coerce.number().int().positive(),
  changeReason: z.string().trim().optional().or(z.literal("")),
});

export type DocumentVersionFormState = { errors?: Record<string, string[]>; formError?: string };

/** changedFields/previousValues/newValues/contentSnapshot وapprovalId/supersededById بلا واجهة
 * إدخال — نفس نمط Document.content/approvalId. createdBy بيتحدَّد تلقائيًا بالمستخدم الحالي، نفس
 * نمط CAPA.ownerId. */
export async function createDocumentVersion(dealId: string, _prevState: DocumentVersionFormState, formData: FormData): Promise<DocumentVersionFormState> {
  const parsed = DocumentVersionSchema.safeParse({
    documentId: formData.get("documentId"),
    versionNumber: formData.get("versionNumber"),
    changeReason: formData.get("changeReason") || undefined,
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const user = await requireCurrentUser();
  const scope = await requirePermission(user.roleId, "DocumentVersion", "Create");
  const { changeReason, ...rest } = parsed.data;

  try {
    const scopedPrisma = await getScopedPrisma();
    const deal = await scopedPrisma.deal.findUniqueOrThrow({
      where: { id: dealId },
      include: { opportunity: { select: { ownerId: true } } },
    });
    await assertOwnScope(scope, deal.opportunity.ownerId, user);

    await withScopedTransaction(async (tx) => {
      const version = await tx.documentVersion.create({
        data: {
          orgId: user.orgId,
          createdBy: user.id,
          changeReason: changeReason || undefined,
          ...rest,
        },
      });
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "documentVersion.created",
        entityType: "DocumentVersion",
        entityId: version.id,
        afterValue: { changeReason: changeReason || null, ...rest },
      });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "createDocumentVersion", error: e });
    return { formError: "حصل خطأ أثناء تسجيل الإصدار — حاول تاني." };
  }

  revalidatePath(`/deals/${dealId}`);
  return {};
}

// ⚠️ الإنشاء مقصور على Accrued بس — نفس نمط CAPA_INITIAL_STATUSES. Approved بقى انتقال إداري
// منفصل، وPaid بيحصل بس عبر payCommissionEntryAction اللي بيرحّل قيد فعلي (Trigger
// enforce_commission_entry_paid بيرفض Paid بلا journalEntryId مهما حصل).
const COMMISSION_ENTRY_INITIAL_STATUSES = ["Accrued"] as const;

const CommissionEntrySchema = z.object({
  planId: z.string().uuid("اختر خطة عمولة"),
  userId: z.string().uuid("اختر مستخدم"),
  salesOrderId: z.string().uuid().optional().or(z.literal("")),
  amount: z.coerce.number().positive("المبلغ مطلوب"),
  currency: z.string().trim().length(3).toUpperCase().optional().or(z.literal("")),
  status: z.enum(COMMISSION_ENTRY_INITIAL_STATUSES),
});

export type CommissionEntryFormState = { errors?: Record<string, string[]>; formError?: string };

/** userId مش تلقائي بالمستخدم الحالي — العمولة بتتسجّل لموظف مبيعات تاني غالبًا. journalEntryId
 * بقى FK حقيقي (وحدة 8 قفلت 19/19 في 2 سبتمبر) — بيتملّى بس عبر payCommissionEntryAction. */
export async function createCommissionEntry(dealId: string, _prevState: CommissionEntryFormState, formData: FormData): Promise<CommissionEntryFormState> {
  const parsed = CommissionEntrySchema.safeParse({
    planId: formData.get("planId"),
    userId: formData.get("userId"),
    salesOrderId: formData.get("salesOrderId") || undefined,
    amount: formData.get("amount"),
    currency: formData.get("currency") || undefined,
    status: formData.get("status"),
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const user = await requireCurrentUser();
  const scope = await requirePermission(user.roleId, "CommissionEntry", "Create");
  const { salesOrderId, currency, ...rest } = parsed.data;

  try {
    const scopedPrisma = await getScopedPrisma();
    const deal = await scopedPrisma.deal.findUniqueOrThrow({
      where: { id: dealId },
      include: { opportunity: { select: { ownerId: true } } },
    });
    await assertOwnScope(scope, deal.opportunity.ownerId, user);

    // planId/userId إلزاميين وغير nullable في الـschema، وبيتعرضوا بلا أي `?.` في `/deals/[id]`
    // (`c.plan.name`, `c.user.fullName`) — لازم يتحقق إنهم فعلًا بتوع نفس المنظمة قبل الإنشاء،
    // وإلا كسر الصفحة كلها لأي حد يفتحها (اتكشف في مراجعة وحدة 3، 6 سبتمبر، نفس نمط Competitor).
    // ⚠️ مش Promise.all — راجع BACKLOG.md (P2028).
    const plan = await scopedPrisma.commissionPlan.findFirst({ where: { id: rest.planId } });
    if (!plan) return { formError: "خطة العمولة غير موجودة." };
    const targetUser = await scopedPrisma.user.findFirst({ where: { id: rest.userId } });
    if (!targetUser) return { formError: "المستخدم غير موجود." };
    if (salesOrderId) {
      const salesOrder = await scopedPrisma.salesOrder.findFirst({ where: { id: salesOrderId } });
      if (!salesOrder) return { formError: "أمر البيع غير موجود." };
    }

    await withScopedTransaction(async (tx) => {
      const entry = await tx.commissionEntry.create({
        data: {
          orgId: user.orgId,
          dealId,
          salesOrderId: salesOrderId || undefined,
          currency: currency || undefined,
          ...rest,
        },
      });
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "commissionEntry.created",
        entityType: "CommissionEntry",
        entityId: entry.id,
        afterValue: { dealId, salesOrderId: salesOrderId || null, ...rest },
      });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "createCommissionEntry", error: e });
    return { formError: "حصل خطأ أثناء تسجيل العمولة — حاول تاني." };
  }

  revalidatePath(`/deals/${dealId}`);
  return {};
}

/** بيتأكد إن ownerId الصفقة المرتبطة بعمولة معيّنة بيحترم scope المستخدم (Own/Team) — نفس نمط
 * assertOwnScope المطبَّق على باقي أفعال هذا الملف، كان ناقص هنا (اتكشف في مراجعة وحدة 2، 6 سبتمبر):
 * SalesManager عنده Team scope فعليًا على CommissionEntry.Edit، وبلا الفحص ده كان يقدر يعتمد/يسدد
 * عمولة أي فريق تاني في المنظمة. `dealId` هنا بيتاخد من `entry.dealId` (القاعدة) مش من أي باراميتر
 * مُرسَل من العميل، عشان محدش يقدر يزوّر مصدر الملكية. عمولات بلا `dealId` (Deal? nullable) بتتخطّى
 * الفحص — مفيش صفقة تتتبّع ملكيتها منها أصلًا. */
async function assertCommissionEntryOwnScope(tx: ScopedTx, scope: Awaited<ReturnType<typeof requirePermission>>, entryDealId: string | null, user: { id: string; teamId: string | null }) {
  if (!entryDealId) return;
  const deal = await tx.deal.findUnique({ where: { id: entryDealId }, include: { opportunity: { select: { ownerId: true } } } });
  if (!deal) return;
  await assertOwnScope(scope, deal.opportunity.ownerId, user);
}

/** موافقة إدارية بس — بلا أي أثر محاسبي. الترحيل الفعلي بيحصل بس عند السداد. */
export async function approveCommissionEntryAction(dealId: string, entryId: string) {
  const user = await requireCurrentUser();
  const scope = await requirePermission(user.roleId, "CommissionEntry", "Edit");

  try {
    await withScopedTransaction(async (tx) => {
      const entry = await tx.commissionEntry.findUniqueOrThrow({ where: { id: entryId } });
      await assertCommissionEntryOwnScope(tx, scope, entry.dealId, user);
      if (entry.status !== "Accrued") throw new Error(`العمولة حالتها ${entry.status} — المستحقة (Accrued) بس اللي تتعتمد.`);
      await tx.commissionEntry.update({ where: { id: entryId }, data: { status: "Approved" } });
      await logAudit(tx, { orgId: user.orgId, userId: user.id, action: "commissionEntry.approved", entityType: "CommissionEntry", entityId: entryId });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "approveCommissionEntryAction", error: e });
    throw new Error(businessRuleMessage(e, "حصل خطأ أثناء اعتماد العمولة."));
  }

  revalidatePath(`/deals/${dealId}`);
}

/** سداد العمولة — بيرحّل القيد فعليًا (مدين 6020 عمولات مبيعات / دائن 1010 نقدية) قبل ما يعلّم
 * الحالة "مدفوعة". ⚠️ بلا Payment/BankAccount عمدًا — راجع تعليق postCommissionPayment. */
export async function payCommissionEntryAction(dealId: string, entryId: string) {
  const user = await requireCurrentUser();
  const scope = await requirePermission(user.roleId, "CommissionEntry", "Edit");

  try {
    await withScopedTransaction(async (tx) => {
      const entry = await tx.commissionEntry.findUniqueOrThrow({ where: { id: entryId } });
      await assertCommissionEntryOwnScope(tx, scope, entry.dealId, user);
      if (entry.status !== "Approved") throw new Error(`العمولة حالتها ${entry.status} — المعتمَدة (Approved) بس اللي تتسدد.`);

      const paidAt = new Date();
      const journalEntryId = await postCommissionPayment(tx, { ...entry, currency: entry.currency ?? "EGP" }, paidAt, user.id);

      await tx.commissionEntry.update({ where: { id: entryId }, data: { status: "Paid", journalEntryId } });
      await logAudit(tx, { orgId: user.orgId, userId: user.id, action: "commissionEntry.paid", entityType: "CommissionEntry", entityId: entryId, afterValue: { journalEntryId } });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "payCommissionEntryAction", error: e });
    throw new Error(businessRuleMessage(e, "حصل خطأ أثناء سداد العمولة."));
  }

  revalidatePath(`/deals/${dealId}`);
}
