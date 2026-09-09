"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getScopedPrisma, withScopedTransaction } from "@/lib/scoped-prisma";
import { requireCurrentUser } from "@/lib/session";
import { requirePermission } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { analyzeMarketWithAI, type AiMarketAnalysis } from "@/lib/ai/analyzeMarket";
import { computeOpportunityRiskSuggestion, type ScoringResult } from "@/lib/opportunityScoring";
import { logError, isNextControlFlowError, businessRuleMessage } from "@/lib/errorLog";

const AnalysisSchema = z.object({
  productId: z.string().uuid("اختر منتج"),
  marketId: z.string().uuid("اختر سوق"),
  year: z.coerce.number().int().min(2020, "السنة لازم تكون 2020 أو بعدها").max(2100, "السنة لازم تكون منطقية"),
  opportunityScore: z.coerce.number().int().min(0, "لازم يكون 0 أو أكتر").max(100, "لازم يكون 100 أو أقل"),
  riskScore: z.coerce.number().int().min(0, "لازم يكون 0 أو أكتر").max(100, "لازم يكون 100 أو أقل"),
  confidenceLevel: z.coerce.number().int().min(0, "لازم يكون 0 أو أكتر").max(100, "لازم يكون 100 أو أقل").optional(),
  recommendation: z.enum(["Start", "Study", "Monitor", "Avoid"], "اختار توصية صحيحة"),
});

export type AnalysisFormState = {
  errors?: Partial<Record<keyof z.infer<typeof AnalysisSchema>, string[]>>;
  formError?: string;
};

export async function createAnalysis(
  _prevState: AnalysisFormState,
  formData: FormData
): Promise<AnalysisFormState> {
  const parsed = AnalysisSchema.safeParse({
    productId: formData.get("productId"),
    marketId: formData.get("marketId"),
    year: formData.get("year"),
    opportunityScore: formData.get("opportunityScore"),
    riskScore: formData.get("riskScore"),
    confidenceLevel: formData.get("confidenceLevel") || undefined,
    recommendation: formData.get("recommendation"),
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  // requireCurrentUser() بيعمل redirect() داخليًا لو الجلسة انتهت — لازم يكون برّه try/catch.
  const user = await requireCurrentUser();
  try {
    await requirePermission(user.roleId, "Analysis", "Create");
    const scopedPrisma = await getScopedPrisma();

    // لازم نتأكد إن المنتج والسوق فعلًا بتوع نفس المنظمة قبل الإنشاء — الـFK بيتحقق بس من
    // وجود الصف في الجدول (أي منظمة)، RLS مش بيتفحّص وقت تنفيذ FK constraint، فمن غير الفحص
    // ده كان ينفع تُدخَل productId/marketId من منظمة تانية (مُتحقَّق فعليًا بسكريبت مباشر) —
    // نفس فحص createAiAnalysis تحت، بس هنا لازم نعمله يدويًا لأن مفيش استدعاء AI يعمله بدلنا.
    // ⚠️ مش Promise.all — راجع BACKLOG.md (P2028).
    const product = await scopedPrisma.product.findFirst({ where: { id: parsed.data.productId, deletedAt: null } });
    const market = await scopedPrisma.market.findFirst({ where: { id: parsed.data.marketId, deletedAt: null } });
    if (!product || !market) return { formError: "المنتج أو السوق غير موجودين." };

    await withScopedTransaction(async (tx) => {
      const analysis = await tx.productMarketAnalysis.create({
        data: { orgId: user.orgId, ...parsed.data },
      });
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "productMarketAnalysis.created",
        entityType: "ProductMarketAnalysis",
        entityId: analysis.id,
        afterValue: parsed.data,
      });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "createAnalysis", error: e });
    return { formError: "حصل خطأ أثناء الحفظ — تأكد إن المنتج والسوق موجودين فعلًا." };
  }

  revalidatePath("/analysis");
  redirect("/analysis");
}

export type AnalysisSuggestionState = { result?: ScoringResult; formError?: string };

/** اقتراح آلي (Rule-Based، مش AI) لدرجتَي الفرصة والمخاطرة بناءً على بيانات حقيقية مسجّلة فعليًا —
 * مخاطرة السوق + مواسم توفّر المنتج + بيانات المنافسين الموسمية. راجع src/lib/opportunityScoring.ts.
 * قابل للتعديل بالكامل في الفورم — اقتراح بداية، مش قيد صلب. */
export async function computeAnalysisSuggestionAction(productId: string, marketId: string): Promise<AnalysisSuggestionState> {
  const user = await requireCurrentUser();
  try {
    await requirePermission(user.roleId, "Analysis", "Create");
    const scopedPrisma = await getScopedPrisma();

    // ⚠️ مش Promise.all — راجع BACKLOG.md (P2028).
    const product = await scopedPrisma.product.findFirst({ where: { id: productId, deletedAt: null } });
    const market = await scopedPrisma.market.findFirst({ where: { id: marketId, deletedAt: null } });
    if (!product || !market) return { formError: "المنتج أو السوق غير موجودين." };
    const competitors = await scopedPrisma.competitor.findMany({
      where: { productId, marketId, deletedAt: null },
      select: { strengthMonths: true, weaknessMonths: true },
    });

    const result = computeOpportunityRiskSuggestion({
      politicalRiskScore: market.politicalRiskScore,
      logisticsRiskScore: market.logisticsRiskScore,
      productAvailableMonths: product.availableMonths,
      competitors,
    });
    return { result };
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "computeAnalysisSuggestionAction", error: e });
    return { formError: "حصل خطأ أثناء حساب الاقتراح." };
  }
}

const AiAnalysisSchema = z.object({
  productId: z.string().uuid("اختر منتج"),
  marketId: z.string().uuid("اختر سوق"),
  year: z.coerce.number().int().min(2020, "السنة لازم تكون 2020 أو بعدها").max(2100, "السنة لازم تكون منطقية"),
});

export type AiAnalysisFormState = {
  errors?: Partial<Record<keyof z.infer<typeof AiAnalysisSchema>, string[]>>;
  formError?: string;
};

/** بيحفظ نتيجة تحليل AI جاهزة (منتج+سوق اتفحصوا واتحقق منهم بالفعل) — مستخرجة من createAiAnalysis
 * عشان processNextBatchItem في batchActions.ts يقدر يستخدم نفس منطق الحفظ بالحرف لكل تركيبة في
 * دفعة "حلّل كل المنتجات × كل الأسواق"، بلا تكرار كود.
 *
 * product/market بيوصلوا بالكامل من الاستدعاءين الحاليين (createAiAnalysis وprocessNextBatchItem)
 * بلا select ضيّق — استخدمت الحقول دي مباشرة بدل إعادة استعلام داخل الـtransaction. */
export async function saveAiMarketAnalysis(
  orgId: string,
  userId: string,
  product: { id: string; availableMonths: number[] },
  market: { id: string; politicalRiskScore: number | null; logisticsRiskScore: number | null },
  year: number,
  result: AiMarketAnalysis
): Promise<string> {
  return withScopedTransaction(async (tx) => {
    // مساءلة الرقم — مقارنة تقييم الـAI بمحرك القواعد (Rule-Based، بيانات حقيقية مسجّلة فعليًا)
    // بدل ما نصدّق رقم الـAI أعمى. فرق كبير (>25 نقطة) مش رفض، بس علامة "راجع ده" ظاهرة للمستخدم.
    const competitorsForScoring = await tx.competitor.findMany({
      where: { orgId, productId: product.id, marketId: market.id, deletedAt: null },
      select: { strengthMonths: true, weaknessMonths: true },
    });
    const ruleBased = computeOpportunityRiskSuggestion({
      politicalRiskScore: market.politicalRiskScore,
      logisticsRiskScore: market.logisticsRiskScore,
      productAvailableMonths: product.availableMonths,
      competitors: competitorsForScoring,
    });
    const opportunityDiff = Math.abs(result.opportunityScore - ruleBased.opportunityScore);
    const riskDiff = Math.abs(result.riskScore - ruleBased.riskScore);
    const needsReview = opportunityDiff > 25 || riskDiff > 25;

    const analysis = await tx.productMarketAnalysis.create({
      data: {
        orgId,
        productId: product.id,
        marketId: market.id,
        year,
        opportunityScore: result.opportunityScore,
        riskScore: result.riskScore,
        confidenceLevel: result.confidenceLevel,
        recommendation: result.recommendation,
        source: "AI",
        needsReview,
        aiReasoning: result.reasoning,
        aiSources: result.sources,
        aiDetails: {
          marketOverview: result.marketOverview,
          demandDrivers: result.demandDrivers,
          keyRisks: result.keyRisks,
          regulatoryNotes: result.regulatoryNotes,
          priceEstimate: result.priceEstimate,
          recommendedNextSteps: result.recommendedNextSteps,
          rejectedSourcesCount: result.rejectedSourcesCount,
          ruleBasedComparison: { opportunityScore: ruleBased.opportunityScore, riskScore: ruleBased.riskScore, reasoning: ruleBased.reasoning, opportunityDiff, riskDiff },
        },
      },
    });

    await logAudit(tx, {
      orgId,
      userId,
      action: "productMarketAnalysis.aiCreated",
      entityType: "ProductMarketAnalysis",
      entityId: analysis.id,
      afterValue: {
        opportunityScore: result.opportunityScore,
        riskScore: result.riskScore,
        recommendation: result.recommendation,
      },
    });
    return analysis.id;
  });
}

export async function createAiAnalysis(
  _prevState: AiAnalysisFormState,
  formData: FormData
): Promise<AiAnalysisFormState> {
  const parsed = AiAnalysisSchema.safeParse({
    productId: formData.get("productId"),
    marketId: formData.get("marketId"),
    year: formData.get("year"),
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  // requireCurrentUser() بيعمل redirect() داخليًا لو الجلسة انتهت — لازم يكون برّه try/catch.
  const user = await requireCurrentUser();
  let analysisId: string;
  try {
    await requirePermission(user.roleId, "Analysis", "Create");
    const prisma = await getScopedPrisma();

    // ⚠️ مش Promise.all — راجع BACKLOG.md (P2028: تعارض على اتصال الـpool بين استعلامين متوازيين
    // من getScopedPrisma()، كل واحد بيفتح transaction لوحده).
    const product = await prisma.product.findFirst({ where: { id: parsed.data.productId, deletedAt: null } });
    const market = await prisma.market.findFirst({ where: { id: parsed.data.marketId, deletedAt: null } });
    if (!product || !market) return { formError: "المنتج أو السوق غير موجودين." };

    const result = await analyzeMarketWithAI(product, market, user.orgId);
    analysisId = await saveAiMarketAnalysis(user.orgId, user.id, product, market, parsed.data.year, result);
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "createAiAnalysis", error: e });
    return { formError: businessRuleMessage(e, "حصل خطأ أثناء التحليل — حاول تاني.") };
  }

  revalidatePath("/analysis");
  redirect(`/analysis/${analysisId}`);
}
