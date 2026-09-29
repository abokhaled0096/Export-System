"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getScopedPrisma, withScopedTransaction } from "@/lib/scoped-prisma";
import { requireCurrentUser } from "@/lib/session";
import { requirePermission } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { logError, isNextControlFlowError } from "@/lib/errorLog";
import { optionalCurrencySchema } from "@/lib/currencySchema";

const CONTAINER_TYPES = ["GP20", "GP40", "HC40", "RF20", "RF40", "HCRF40", "OpenTop", "FlatRack", "Tank"] as const;
const FREIGHT_QUOTE_STATUSES = ["Draft", "Approved", "Expired"] as const;

const FreightQuoteSchema = z.object({
  routeId: z.string().uuid("اختر خط شحن"),
  providerId: z.string().uuid("اختر مزوّد خدمة"),
  containerType: z.enum(CONTAINER_TYPES, "اختار نوع حاوية صحيح").optional().or(z.literal("")),
  originCharges: z.coerce.number().min(0, "لازم يكون 0 أو أكتر").optional(),
  mainFreight: z.coerce.number().min(0, "لازم يكون 0 أو أكتر").optional(),
  destinationCharges: z.coerce.number().min(0, "لازم يكون 0 أو أكتر").optional(),
  insurance: z.coerce.number().min(0, "لازم يكون 0 أو أكتر").optional(),
  currency: optionalCurrencySchema,
  transitDays: z.coerce.number().int().min(0, "لازم يكون 0 أو أكتر").optional(),
  freeTimeDays: z.coerce.number().int().min(0, "لازم يكون 0 أو أكتر").optional(),
  validFrom: z.string().trim().optional().or(z.literal("")),
  validUntil: z.string().trim().optional().or(z.literal("")),
  status: z.enum(FREIGHT_QUOTE_STATUSES, "اختار حالة عرض سعر شحن صحيحة"),
});

export type FreightQuoteFormState = { errors?: Record<string, string[]>; formError?: string };

export async function createFreightQuote(_prevState: FreightQuoteFormState, formData: FormData): Promise<FreightQuoteFormState> {
  const parsed = FreightQuoteSchema.safeParse({
    routeId: formData.get("routeId"),
    providerId: formData.get("providerId"),
    containerType: formData.get("containerType") || undefined,
    originCharges: formData.get("originCharges") || undefined,
    mainFreight: formData.get("mainFreight") || undefined,
    destinationCharges: formData.get("destinationCharges") || undefined,
    insurance: formData.get("insurance") || undefined,
    currency: formData.get("currency") || undefined,
    transitDays: formData.get("transitDays") || undefined,
    freeTimeDays: formData.get("freeTimeDays") || undefined,
    validFrom: formData.get("validFrom") || undefined,
    validUntil: formData.get("validUntil") || undefined,
    status: formData.get("status"),
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const user = await requireCurrentUser();
  const { containerType, currency, validFrom, validUntil, ...rest } = parsed.data;
  let quoteId: string;
  try {
    await requirePermission(user.roleId, "FreightQuote", "Create");
    // routeId/providerId إلزاميين وغير nullable، وبيتعرضوا بلا `?.` في قائمة/تفاصيل عروض
    // الشحن (`quote.route.originPort`, `quote.provider.name`) — أي id عابر للمنظمة كان هيكسر
    // الصفحتين بالكامل (اتكشف في مراجعة وحدة 6، 6 سبتمبر، نفس فئة addShipmentLot فوق).
    const scopedPrisma = await getScopedPrisma();
    const route = await scopedPrisma.route.findFirst({ where: { id: rest.routeId } });
    if (!route) return { formError: "خط الشحن غير موجود." };
    const provider = await scopedPrisma.serviceProvider.findFirst({ where: { id: rest.providerId } });
    if (!provider) return { formError: "مزوّد الخدمة غير موجود." };
    quoteId = await withScopedTransaction(async (tx) => {
      const quote = await tx.freightQuote.create({
        data: {
          orgId: user.orgId,
          containerType: containerType || undefined,
          currency: currency || undefined,
          validFrom: validFrom ? new Date(validFrom) : undefined,
          validUntil: validUntil ? new Date(validUntil) : undefined,
          ...rest,
        },
      });
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "freightQuote.created",
        entityType: "FreightQuote",
        entityId: quote.id,
        afterValue: { containerType: containerType || null, currency: currency || null, ...rest },
      });
      return quote.id;
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "createFreightQuote", error: e });
    return { formError: "حصل خطأ أثناء إضافة عرض السعر — حاول تاني." };
  }

  revalidatePath("/logistics/quotes");
  redirect(`/logistics/quotes/${quoteId}`);
}

const LINE_CATEGORIES = ["Origin", "Freight", "Destination", "Insurance", "Other"] as const;
const FreightQuoteLineSchema = z.object({
  chargeCode: z.string().trim().min(1, "كود البند مطلوب"),
  category: z.enum(LINE_CATEGORIES, "اختار فئة بند صحيحة"),
  amount: z.coerce.number().min(0, "المبلغ مطلوب"),
  currency: optionalCurrencySchema,
});

export type FreightQuoteLineFormState = { errors?: Record<string, string[]>; formError?: string };

export async function addFreightQuoteLine(
  freightQuoteId: string,
  _prevState: FreightQuoteLineFormState,
  formData: FormData
): Promise<FreightQuoteLineFormState> {
  const parsed = FreightQuoteLineSchema.safeParse({
    chargeCode: formData.get("chargeCode"),
    category: formData.get("category"),
    amount: formData.get("amount"),
    currency: formData.get("currency") || undefined,
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const user = await requireCurrentUser();
  const { currency, ...rest } = parsed.data;
  try {
    await requirePermission(user.roleId, "FreightQuoteLine", "Create");
    await withScopedTransaction(async (tx) => {
      const line = await tx.freightQuoteLine.create({
        data: { orgId: user.orgId, freightQuoteId, currency: currency || undefined, ...rest },
      });
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "freightQuoteLine.created",
        entityType: "FreightQuoteLine",
        entityId: line.id,
        afterValue: { freightQuoteId, currency: currency || null, ...rest },
      });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "addFreightQuoteLine", error: e });
    return { formError: "حصل خطأ أثناء إضافة بند التكلفة — حاول تاني." };
  }

  revalidatePath(`/logistics/quotes/${freightQuoteId}`);
  return {};
}
