"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getScopedPrisma, withScopedTransaction } from "@/lib/scoped-prisma";
import { requireCurrentUser } from "@/lib/session";
import { requirePermission } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { logError, isNextControlFlowError } from "@/lib/errorLog";

const MarketSchema = z.object({
  countryNameAr: z.string().trim().min(2, "اسم الدولة بالعربية مطلوب"),
  countryNameEn: z.string().trim().min(2, "اسم الدولة بالإنجليزية مطلوب"),
  countryCode: z
    .string()
    .trim()
    .length(2, "كود الدولة لازم يكون حرفين (ISO 3166)")
    .toUpperCase(),
  continent: z.string().trim().min(1, "القارة مطلوبة"),
  currency: z.string().trim().length(3, "العملة لازم تكون 3 أحرف (ISO 4217)").toUpperCase(),
  mainPorts: z.string().trim().optional(),
  tradeAgreement: z.string().trim().optional(),
  politicalRiskScore: z.coerce.number().int().min(0, "لازم يكون 0 أو أكتر").max(100, "لازم يكون 100 أو أقل").optional(),
  logisticsRiskScore: z.coerce.number().int().min(0, "لازم يكون 0 أو أكتر").max(100, "لازم يكون 100 أو أقل").optional(),
});

export type MarketFormState = {
  errors?: Partial<Record<keyof z.infer<typeof MarketSchema>, string[]>>;
  formError?: string;
};

export async function createMarket(
  _prevState: MarketFormState,
  formData: FormData
): Promise<MarketFormState> {
  const parsed = MarketSchema.safeParse({
    countryNameAr: formData.get("countryNameAr"),
    countryNameEn: formData.get("countryNameEn"),
    countryCode: formData.get("countryCode"),
    continent: formData.get("continent"),
    currency: formData.get("currency"),
    mainPorts: formData.get("mainPorts") || undefined,
    tradeAgreement: formData.get("tradeAgreement") || undefined,
    politicalRiskScore: formData.get("politicalRiskScore") || undefined,
    logisticsRiskScore: formData.get("logisticsRiskScore") || undefined,
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  // requireCurrentUser() بيعمل redirect() داخليًا لو الجلسة انتهت — لازم يكون برّه try/catch.
  const user = await requireCurrentUser();
  try {
    await requirePermission(user.roleId, "Market", "Create");
    const scopedPrisma = await getScopedPrisma();

    // كود الدولة (ISO 3166) معرّف فريد حقيقي (عكس HS Code بتاع المنتج) — دولة واحدة معندهاش كودين،
    // فيصح يتمنع بصرامة. فيه فهرس جزئي فعلي على مستوى القاعدة (Market_orgId_countryCode_active_key)
    // كخط دفاع أخير، لكن الفحص هنا بيدّي رسالة عربي واضحة بدل خطأ DB خام.
    const existing = await scopedPrisma.market.findFirst({ where: { countryCode: parsed.data.countryCode, deletedAt: null } });
    if (existing) {
      return { errors: { countryCode: [`السوق ده متسجّل بالفعل: "${existing.countryNameAr}"`] } };
    }

    const { mainPorts, ...rest } = parsed.data;
    await withScopedTransaction(async (tx) => {
      const market = await tx.market.create({
        data: {
          orgId: user.orgId,
          ...rest,
          mainPorts: mainPorts
            ? mainPorts.split(",").map((p) => p.trim()).filter(Boolean)
            : [],
        },
      });
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "market.created",
        entityType: "Market",
        entityId: market.id,
        afterValue: rest,
      });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "createMarket", error: e });
    return { formError: "حصل خطأ أثناء الحفظ — حاول تاني." };
  }

  revalidatePath("/markets");
  redirect("/markets");
}

const UpdateMarketSchema = z.object({
  tradeAgreement: z.string().trim().optional(),
  politicalRiskScore: z.coerce.number().int().min(0, "لازم يكون 0 أو أكتر").max(100, "لازم يكون 100 أو أقل").optional(),
  logisticsRiskScore: z.coerce.number().int().min(0, "لازم يكون 0 أو أكتر").max(100, "لازم يكون 100 أو أقل").optional(),
});

export type UpdateMarketFormState = {
  errors?: Partial<Record<keyof z.infer<typeof UpdateMarketSchema>, string[]>>;
  formError?: string;
};

/** تحديث درجات المخاطرة/الاتفاقية التجارية — الحقول التلاتة دي كانت موجودة في الـschema بلا أي
 * فورم يوصلها أصلًا (اتكشف في مراجعة وحدة 1، 6 سبتمبر). `lastReviewedAt` بيتحدّث تلقائيًا هنا —
 * هي بالظبط معنى "آخر مراجعة" فمفيش داعي لحقل يدوي منفصل. */
export async function updateMarket(
  marketId: string,
  _prevState: UpdateMarketFormState,
  formData: FormData
): Promise<UpdateMarketFormState> {
  const parsed = UpdateMarketSchema.safeParse({
    tradeAgreement: formData.get("tradeAgreement") || undefined,
    politicalRiskScore: formData.get("politicalRiskScore") || undefined,
    logisticsRiskScore: formData.get("logisticsRiskScore") || undefined,
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const user = await requireCurrentUser();
  try {
    await requirePermission(user.roleId, "Market", "Edit");
    await withScopedTransaction(async (tx) => {
      await tx.market.update({
        where: { id: marketId },
        data: { ...parsed.data, lastReviewedAt: new Date() },
      });
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "market.updated",
        entityType: "Market",
        entityId: marketId,
        afterValue: parsed.data,
      });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "updateMarket", error: e });
    return { formError: "حصل خطأ أثناء التحديث — حاول تاني." };
  }

  revalidatePath(`/markets/${marketId}`);
  return {};
}

const ArchiveMarketSchema = z.string().uuid();

export async function archiveMarket(marketId: string) {
  const parsed = ArchiveMarketSchema.safeParse(marketId);
  if (!parsed.success) throw new Error("معرّف سوق غير صالح.");

  const user = await requireCurrentUser();
  await requirePermission(user.roleId, "Market", "Edit");
  try {
    await withScopedTransaction(async (tx) => {
      await tx.market.update({ where: { id: parsed.data }, data: { deletedAt: new Date() } });
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "market.archived",
        entityType: "Market",
        entityId: parsed.data,
      });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "archiveMarket", error: e });
    throw new Error("حصل خطأ أثناء الأرشفة — حاول تاني.");
  }

  revalidatePath("/markets");
  revalidatePath("/markets/archived");
}

const RestoreMarketSchema = z.string().uuid();

export async function restoreMarket(marketId: string) {
  const parsed = RestoreMarketSchema.safeParse(marketId);
  if (!parsed.success) throw new Error("معرّف سوق غير صالح.");

  const user = await requireCurrentUser();
  await requirePermission(user.roleId, "Market", "Edit");
  try {
    await withScopedTransaction(async (tx) => {
      await tx.market.update({ where: { id: parsed.data }, data: { deletedAt: null } });
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "market.restored",
        entityType: "Market",
        entityId: parsed.data,
      });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "restoreMarket", error: e });
    throw new Error("حصل خطأ أثناء الاستعادة — حاول تاني.");
  }

  revalidatePath("/markets");
  revalidatePath("/markets/archived");
}
