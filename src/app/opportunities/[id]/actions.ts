"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getScopedPrisma, withScopedTransaction } from "@/lib/scoped-prisma";
import { requireCurrentUser } from "@/lib/session";
import { requirePermission, assertOwnScope } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { logError, isNextControlFlowError } from "@/lib/errorLog";

/** بيرجّع الفرصة نفسها (مش بس تفحص scope) — لازم نستخدم بياناتها (companyId مثلًا) للتحقق من
 * إن أي FK تاني بيتبعت من الفورم (contactId/negotiationId..) فعلًا بتاعها هي، مش فرصة/كيان
 * تاني بالغلط أو بقصد (راجع مراجعة وحدة 3، 6 سبتمبر). */
async function assertOpportunityOwnScope(scope: Awaited<ReturnType<typeof requirePermission>>, opportunityId: string, user: Awaited<ReturnType<typeof requireCurrentUser>>) {
  const scopedPrisma = await getScopedPrisma();
  const opportunity = await scopedPrisma.opportunity.findUniqueOrThrow({
    where: { id: opportunityId },
  });
  await assertOwnScope(scope, opportunity.ownerId, user);
  return opportunity;
}

const COMMUNICATION_CHANNELS = ["Email", "WhatsApp", "Phone", "VideoMeeting", "PhysicalMeeting", "LinkedIn", "WebsiteInquiry", "Exhibition"] as const;
const COMMUNICATION_DIRECTIONS = ["Inbound", "Outbound"] as const;

const CommunicationSchema = z.object({
  companyId: z.string().uuid(),
  contactId: z.string().uuid().optional().or(z.literal("")),
  channel: z.enum(COMMUNICATION_CHANNELS),
  direction: z.enum(COMMUNICATION_DIRECTIONS),
  subject: z.string().trim().optional().or(z.literal("")),
  summary: z.string().trim().optional().or(z.literal("")),
  occurredAt: z.string().trim().min(1, "تاريخ التواصل مطلوب"),
  requiresReply: z.coerce.boolean().optional(),
  respondedAt: z.string().trim().optional().or(z.literal("")),
});

export type CommunicationFormState = { errors?: Record<string, string[]>; formError?: string };

/** responseTimeHours (⚙️) بيتحسب هنا وقت الحفظ لو respondedAt موجود — نفس نمط quantitySaleable
 * في docs/SCOPE-P2.md §4، مش Generated Column. */
export async function createCommunication(opportunityId: string, _prevState: CommunicationFormState, formData: FormData): Promise<CommunicationFormState> {
  const parsed = CommunicationSchema.safeParse({
    companyId: formData.get("companyId"),
    contactId: formData.get("contactId") || undefined,
    channel: formData.get("channel"),
    direction: formData.get("direction"),
    subject: formData.get("subject") || undefined,
    summary: formData.get("summary") || undefined,
    occurredAt: formData.get("occurredAt"),
    requiresReply: formData.get("requiresReply") === "on",
    respondedAt: formData.get("respondedAt") || undefined,
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const user = await requireCurrentUser();
  const scope = await requirePermission(user.roleId, "Communication", "Create");
  const { contactId, subject, summary, occurredAt, respondedAt, ...rest } = parsed.data;

  try {
    const opportunity = await assertOpportunityOwnScope(scope, opportunityId, user);
    // companyId جاي من الفورم (hidden field) — لازم يطابق فعلًا شركة الفرصة دي، وإلا كان ينفع
    // يتسجّل تواصل بشركة تانية خالص (اتكشف في مراجعة وحدة 3، 6 سبتمبر). contactId (لو موجود)
    // لازم يبقى تابع لنفس الشركة كمان.
    if (parsed.data.companyId !== opportunity.companyId) {
      return { formError: "الشركة دي مش شركة الفرصة." };
    }
    if (contactId) {
      const scopedPrisma = await getScopedPrisma();
      const contact = await scopedPrisma.contact.findFirst({ where: { id: contactId, companyId: opportunity.companyId, erasedAt: null } });
      if (!contact) return { formError: "جهة الاتصال غير موجودة لهذه الشركة." };
    }

    const occurredAtDate = new Date(occurredAt);
    const respondedAtDate = respondedAt ? new Date(respondedAt) : undefined;
    const responseTimeHours = respondedAtDate ? (respondedAtDate.getTime() - occurredAtDate.getTime()) / 3_600_000 : undefined;

    await withScopedTransaction(async (tx) => {
      const communication = await tx.communication.create({
        data: {
          orgId: user.orgId,
          opportunityId,
          contactId: contactId || undefined,
          subject: subject || undefined,
          summary: summary || undefined,
          occurredAt: occurredAtDate,
          respondedAt: respondedAtDate,
          responseTimeHours: responseTimeHours !== undefined ? responseTimeHours.toFixed(2) : undefined,
          ...rest,
        },
      });
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "communication.created",
        entityType: "Communication",
        entityId: communication.id,
        afterValue: { opportunityId, contactId: contactId || null, ...rest },
      });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "createCommunication", error: e });
    return { formError: "حصل خطأ أثناء تسجيل التواصل — حاول تاني." };
  }

  revalidatePath(`/opportunities/${opportunityId}`);
  return {};
}

const RFQ_SERIOUSNESS_LEVELS = ["SeriousBuyer", "PromisingIncomplete", "PriceShopper", "EarlyResearch", "LowIntent", "SuspiciousInquiry"] as const;

const RFQAnalysisSchema = z.object({
  communicationId: z.string().uuid().optional().or(z.literal("")),
  destinationPort: z.string().trim().optional().or(z.literal("")),
  paymentMethod: z.string().trim().optional().or(z.literal("")),
  quantity: z.coerce.number().positive().optional(),
  incoterm: z.string().trim().optional().or(z.literal("")),
  seriousnessLevel: z.enum(RFQ_SERIOUSNESS_LEVELS).optional().or(z.literal("")),
});

export type RFQAnalysisFormState = { errors?: Record<string, string[]>; formError?: string };

export async function createRFQAnalysis(opportunityId: string, _prevState: RFQAnalysisFormState, formData: FormData): Promise<RFQAnalysisFormState> {
  const parsed = RFQAnalysisSchema.safeParse({
    communicationId: formData.get("communicationId") || undefined,
    destinationPort: formData.get("destinationPort") || undefined,
    paymentMethod: formData.get("paymentMethod") || undefined,
    quantity: formData.get("quantity") || undefined,
    incoterm: formData.get("incoterm") || undefined,
    seriousnessLevel: formData.get("seriousnessLevel") || undefined,
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const user = await requireCurrentUser();
  const scope = await requirePermission(user.roleId, "RFQAnalysis", "Create");
  const { communicationId, destinationPort, paymentMethod, incoterm, seriousnessLevel, ...rest } = parsed.data;

  try {
    await assertOpportunityOwnScope(scope, opportunityId, user);
    if (communicationId) {
      const scopedPrisma = await getScopedPrisma();
      const communication = await scopedPrisma.communication.findFirst({ where: { id: communicationId, opportunityId } });
      if (!communication) return { formError: "سجل التواصل غير موجود لهذه الفرصة." };
    }
    await withScopedTransaction(async (tx) => {
      const rfq = await tx.rFQAnalysis.create({
        data: {
          orgId: user.orgId,
          opportunityId,
          communicationId: communicationId || undefined,
          destinationPort: destinationPort || undefined,
          paymentMethod: paymentMethod || undefined,
          incoterm: incoterm || undefined,
          seriousnessLevel: seriousnessLevel || undefined,
          ...rest,
        },
      });
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "rfqAnalysis.created",
        entityType: "RFQAnalysis",
        entityId: rfq.id,
        afterValue: { opportunityId, communicationId: communicationId || null, ...rest },
      });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "createRFQAnalysis", error: e });
    return { formError: "حصل خطأ أثناء إضافة تحليل RFQ — حاول تاني." };
  }

  revalidatePath(`/opportunities/${opportunityId}`);
  return {};
}

const CUSTOMER_SAMPLE_STATUSES = [
  "Requested", "ApprovedInternally", "Preparing", "Shipped", "InTransit", "Delivered", "FeedbackPending", "Approved", "Rejected", "ConvertedToOrder", "Closed",
] as const;

const CustomerSampleSchema = z.object({
  productId: z.string().uuid("اختر منتج"),
  batchId: z.string().uuid().optional().or(z.literal("")),
  quantity: z.coerce.number().positive().optional(),
  totalCost: z.coerce.number().min(0).optional(),
  currency: z.string().trim().length(3).toUpperCase().optional().or(z.literal("")),
  trackingNumber: z.string().trim().optional().or(z.literal("")),
  status: z.enum(CUSTOMER_SAMPLE_STATUSES),
});

export type CustomerSampleFormState = { errors?: Record<string, string[]>; formError?: string };

export async function createCustomerSample(opportunityId: string, _prevState: CustomerSampleFormState, formData: FormData): Promise<CustomerSampleFormState> {
  const parsed = CustomerSampleSchema.safeParse({
    productId: formData.get("productId"),
    batchId: formData.get("batchId") || undefined,
    quantity: formData.get("quantity") || undefined,
    totalCost: formData.get("totalCost") || undefined,
    currency: formData.get("currency") || undefined,
    trackingNumber: formData.get("trackingNumber") || undefined,
    status: formData.get("status"),
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const user = await requireCurrentUser();
  const scope = await requirePermission(user.roleId, "CustomerSample", "Create");
  const { batchId, currency, trackingNumber, ...rest } = parsed.data;

  try {
    await assertOpportunityOwnScope(scope, opportunityId, user);
    const scopedPrisma = await getScopedPrisma();
    // ⚠️ مش Promise.all — راجع BACKLOG.md (P2028).
    const product = await scopedPrisma.product.findFirst({ where: { id: rest.productId, deletedAt: null } });
    if (!product) return { formError: "المنتج غير موجود." };
    if (batchId) {
      const batch = await scopedPrisma.batch.findFirst({ where: { id: batchId } });
      if (!batch) return { formError: "الدفعة غير موجودة." };
    }
    await withScopedTransaction(async (tx) => {
      const sample = await tx.customerSample.create({
        data: {
          orgId: user.orgId,
          opportunityId,
          batchId: batchId || undefined,
          currency: currency || undefined,
          trackingNumber: trackingNumber || undefined,
          ...rest,
        },
      });
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "customerSample.created",
        entityType: "CustomerSample",
        entityId: sample.id,
        afterValue: { opportunityId, batchId: batchId || null, ...rest },
      });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "createCustomerSample", error: e });
    return { formError: "حصل خطأ أثناء إضافة عينة العميل — حاول تاني." };
  }

  revalidatePath(`/opportunities/${opportunityId}`);
  return {};
}

const NEGOTIATION_STATUSES = ["Open", "Stalled", "Agreed", "Failed"] as const;

const NegotiationSchema = z.object({
  status: z.enum(NEGOTIATION_STATUSES),
  currentPrice: z.coerce.number().positive().optional(),
  currency: z.string().trim().length(3).toUpperCase().optional().or(z.literal("")),
});

export type NegotiationFormState = { errors?: Record<string, string[]>; formError?: string };

export async function createNegotiation(opportunityId: string, _prevState: NegotiationFormState, formData: FormData): Promise<NegotiationFormState> {
  const parsed = NegotiationSchema.safeParse({
    status: formData.get("status"),
    currentPrice: formData.get("currentPrice") || undefined,
    currency: formData.get("currency") || undefined,
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const user = await requireCurrentUser();
  const scope = await requirePermission(user.roleId, "Negotiation", "Create");
  const { currency, ...rest } = parsed.data;

  try {
    await assertOpportunityOwnScope(scope, opportunityId, user);
    await withScopedTransaction(async (tx) => {
      const negotiation = await tx.negotiation.create({
        data: { orgId: user.orgId, opportunityId, currency: currency || undefined, ...rest },
      });
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "negotiation.created",
        entityType: "Negotiation",
        entityId: negotiation.id,
        afterValue: { opportunityId, ...rest },
      });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "createNegotiation", error: e });
    return { formError: "حصل خطأ أثناء فتح التفاوض — حاول تاني." };
  }

  revalidatePath(`/opportunities/${opportunityId}`);
  return {};
}

const NEGOTIATION_CONCESSION_TYPES = [
  "Discount", "Credit", "LowerAdvance", "SpecialPackaging", "PrivateLabel", "FasterShipping", "Exclusivity", "FreeSample", "LowerMOQ",
] as const;

const NegotiationRoundSchema = z.object({
  negotiationId: z.string().uuid("اختر تفاوض"),
  roundNumber: z.coerce.number().int().positive(),
  roundDate: z.string().trim().optional().or(z.literal("")),
  customerOffer: z.coerce.number().optional(),
  ourOffer: z.coerce.number().optional(),
  discountPct: z.coerce.number().min(0).max(100).optional(),
  concessionType: z.enum(NEGOTIATION_CONCESSION_TYPES).optional().or(z.literal("")),
  concessionValue: z.coerce.number().optional(),
  outcome: z.string().trim().optional().or(z.literal("")),
});

export type NegotiationRoundFormState = { errors?: Record<string, string[]>; formError?: string };

export async function createNegotiationRound(
  opportunityId: string,
  _prevState: NegotiationRoundFormState,
  formData: FormData
): Promise<NegotiationRoundFormState> {
  const parsed = NegotiationRoundSchema.safeParse({
    negotiationId: formData.get("negotiationId"),
    roundNumber: formData.get("roundNumber"),
    roundDate: formData.get("roundDate") || undefined,
    customerOffer: formData.get("customerOffer") || undefined,
    ourOffer: formData.get("ourOffer") || undefined,
    discountPct: formData.get("discountPct") || undefined,
    concessionType: formData.get("concessionType") || undefined,
    concessionValue: formData.get("concessionValue") || undefined,
    outcome: formData.get("outcome") || undefined,
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const user = await requireCurrentUser();
  const scope = await requirePermission(user.roleId, "NegotiationRound", "Create");
  const { negotiationId, roundDate, concessionType, outcome, ...rest } = parsed.data;

  try {
    await assertOpportunityOwnScope(scope, opportunityId, user);
    // negotiationId جاي من الفورم — لازم يتأكد إنه فعلًا تفاوض تابع لنفس الفرصة اللي المستخدم
    // اتأكدت ملكيته فوق، وإلا كان ينفع يتضاف جولة تفاوض لتفاوض فرصة تانية خالص (اتكشف في
    // مراجعة وحدة 3، 6 سبتمبر) — فحص scope فوق كان بيتحقق من opportunityId المُرسَل، مش من
    // الـnegotiation الفعلي اللي بيتكتب عليه.
    const scopedPrisma = await getScopedPrisma();
    const negotiation = await scopedPrisma.negotiation.findFirst({ where: { id: negotiationId, opportunityId } });
    if (!negotiation) return { formError: "التفاوض غير موجود لهذه الفرصة." };
    await withScopedTransaction(async (tx) => {
      const round = await tx.negotiationRound.create({
        data: {
          orgId: user.orgId,
          negotiationId,
          roundDate: roundDate ? new Date(roundDate) : undefined,
          concessionType: concessionType || undefined,
          outcome: outcome || undefined,
          ...rest,
        },
      });
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "negotiationRound.created",
        entityType: "NegotiationRound",
        entityId: round.id,
        afterValue: { negotiationId, ...rest },
      });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "createNegotiationRound", error: e });
    return { formError: "حصل خطأ أثناء إضافة جولة التفاوض — حاول تاني." };
  }

  revalidatePath(`/opportunities/${opportunityId}`);
  return {};
}
