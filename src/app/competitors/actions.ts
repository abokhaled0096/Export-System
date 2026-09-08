"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getScopedPrisma, withScopedTransaction } from "@/lib/scoped-prisma";
import { requireCurrentUser } from "@/lib/session";
import { requirePermission } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { analyzeCompetitorsWithAI } from "@/lib/ai/analyzeCompetitors";
import { logError, isNextControlFlowError, businessRuleMessage } from "@/lib/errorLog";

const monthsField = z
  .array(z.string())
  .transform((arr) => arr.map(Number))
  .pipe(z.array(z.number().int().min(1, "شهر غير صالح").max(12, "شهر غير صالح")))
  .optional();

const CompetitorSchema = z
  .object({
    productId: z.string().uuid("اختر منتج"),
    marketId: z.string().uuid("اختر سوق"),
    countryName: z.string().trim().min(1, "اسم دولة المنافس مطلوب"),
    strengthMonths: monthsField,
    weaknessMonths: monthsField,
    priceRangeMin: z.coerce.number().min(0, "السعر لازم يكون موجب").optional(),
    priceRangeMax: z.coerce.number().min(0, "السعر لازم يكون موجب").optional(),
    currency: z.string().trim().length(3, "لازم 3 حروف (ISO 4217)").toUpperCase(),
  })
  .refine((data) => data.priceRangeMin === undefined || data.priceRangeMax === undefined || data.priceRangeMin <= data.priceRangeMax, {
    message: "أقل سعر لازم يكون أصغر من أو يساوي أعلى سعر",
    path: ["priceRangeMax"],
  });

export type CompetitorFormState = {
  errors?: Partial<Record<keyof z.infer<typeof CompetitorSchema>, string[]>>;
  formError?: string;
};

/** إدخال يدوي — لمعرفة موثّقة عن منافس بعينه (مش بحث آلي). */
export async function createCompetitor(_prevState: CompetitorFormState, formData: FormData): Promise<CompetitorFormState> {
  const parsed = CompetitorSchema.safeParse({
    productId: formData.get("productId"),
    marketId: formData.get("marketId"),
    countryName: formData.get("countryName"),
    strengthMonths: formData.getAll("strengthMonths"),
    weaknessMonths: formData.getAll("weaknessMonths"),
    priceRangeMin: formData.get("priceRangeMin") || undefined,
    priceRangeMax: formData.get("priceRangeMax") || undefined,
    currency: formData.get("currency"),
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const user = await requireCurrentUser();
  try {
    await requirePermission(user.roleId, "Competitor", "Create");
    const scopedPrisma = await getScopedPrisma();

    // لازم نتأكد إن المنتج والسوق فعلًا بتوع نفس المنظمة قبل الإنشاء — الـFK بيتحقق بس من
    // وجود الصف في الجدول (أي منظمة)، RLS مش بيتفحّص وقت تنفيذ FK constraint، فمن غير الفحص
    // ده كان ينفع تُدخَل productId/marketId من منظمة تانية (مُتحقَّق فعليًا بسكريبت مباشر) —
    // نفس فحص createAiCompetitors تحت، بس هنا لازم نعمله يدويًا لأن مفيش استدعاء AI يعمله بدلنا.
    // ⚠️ مش Promise.all — راجع BACKLOG.md (P2028).
    const product = await scopedPrisma.product.findFirst({ where: { id: parsed.data.productId, deletedAt: null } });
    const market = await scopedPrisma.market.findFirst({ where: { id: parsed.data.marketId, deletedAt: null } });
    if (!product || !market) return { formError: "المنتج أو السوق غير موجودين." };

    await withScopedTransaction(async (tx) => {
      const competitor = await tx.competitor.create({
        data: { orgId: user.orgId, ...parsed.data, strengthMonths: parsed.data.strengthMonths ?? [], weaknessMonths: parsed.data.weaknessMonths ?? [] },
      });
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "competitor.created",
        entityType: "Competitor",
        entityId: competitor.id,
        afterValue: { countryName: parsed.data.countryName },
      });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "createCompetitor", error: e });
    return { formError: "حصل خطأ أثناء الحفظ — تأكد إن المنتج والسوق موجودين فعلًا." };
  }

  revalidatePath("/competitors");
  redirect("/competitors");
}

const AiCompetitorsSchema = z.object({
  productId: z.string().uuid("اختر منتج"),
  marketId: z.string().uuid("اختر سوق"),
});

export type AiCompetitorsFormState = {
  errors?: Partial<Record<keyof z.infer<typeof AiCompetitorsSchema>, string[]>>;
  formError?: string;
};

/** بحث آلي حقيقي عن المنافسين (web_search) — بيرجّع 0 لحد 10 صف دفعة واحدة، كل صف مستقل
 * قابل للمراجعة/الحذف بعد كده زي أي بيانات تانية، مش "حقيقة نهائية" بلا مراجعة بشرية. */
export async function createAiCompetitors(_prevState: AiCompetitorsFormState, formData: FormData): Promise<AiCompetitorsFormState> {
  const parsed = AiCompetitorsSchema.safeParse({
    productId: formData.get("productId"),
    marketId: formData.get("marketId"),
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const user = await requireCurrentUser();
  try {
    await requirePermission(user.roleId, "Competitor", "Create");
    const prisma = await getScopedPrisma();

    // ⚠️ مش Promise.all — راجع BACKLOG.md (P2028).
    const product = await prisma.product.findFirst({ where: { id: parsed.data.productId, deletedAt: null } });
    const market = await prisma.market.findFirst({ where: { id: parsed.data.marketId, deletedAt: null } });
    if (!product || !market) return { formError: "المنتج أو السوق غير موجودين." };

    const results = await analyzeCompetitorsWithAI(product, market, user.orgId);
    if (results.length === 0) {
      return { formError: "الذكاء الاصطناعي بحث فعليًا ومالقاش منافسين حقيقيين مؤكَّدين لهذا المنتج/السوق — جرّب منتج أو سوق تاني، أو سجّل منافس معروف يدويًا." };
    }

    await withScopedTransaction(async (tx) => {
      for (const c of results) {
        const competitor = await tx.competitor.create({
          data: {
            orgId: user.orgId,
            productId: product.id,
            marketId: market.id,
            countryName: c.countryName,
            strengthMonths: c.strengthMonths,
            weaknessMonths: c.weaknessMonths,
            priceRangeMin: c.priceRangeMin ?? undefined,
            priceRangeMax: c.priceRangeMax ?? undefined,
            currency: c.currency.toUpperCase(),
            source: "AI",
            aiReasoning: c.reasoning,
            aiSources: c.sources,
          },
        });
        await logAudit(tx, {
          orgId: user.orgId,
          userId: user.id,
          action: "competitor.aiCreated",
          entityType: "Competitor",
          entityId: competitor.id,
          afterValue: { countryName: c.countryName },
        });
      }
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "createAiCompetitors", error: e });
    return { formError: businessRuleMessage(e, "حصل خطأ أثناء البحث — حاول تاني.") };
  }

  revalidatePath("/competitors");
  redirect("/competitors");
}

/** حذف — للمنافسين اللي طلعوا غير دقيقين بعد المراجعة البشرية (بحث AI مش مضمون 100%). */
export async function deleteCompetitorAction(competitorId: string) {
  const user = await requireCurrentUser();
  await requirePermission(user.roleId, "Competitor", "Create");

  try {
    await withScopedTransaction(async (tx) => {
      await tx.competitor.update({ where: { id: competitorId }, data: { deletedAt: new Date() } });
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "competitor.deleted",
        entityType: "Competitor",
        entityId: competitorId,
      });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "deleteCompetitorAction", error: e });
    throw new Error("حصل خطأ أثناء الحذف.");
  }

  revalidatePath("/competitors");
}
