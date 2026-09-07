"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getScopedPrisma, withScopedTransaction } from "@/lib/scoped-prisma";
import { requireCurrentUser } from "@/lib/session";
import { requirePermission, assertOwnScope } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { logError, isNextControlFlowError } from "@/lib/errorLog";

/** بيرجّع ownerId الصفقة اللي ملف الامتثال ده تابع لها — بيتستخدم لفحص Own/Team scope. مفيش
 * ownerId مباشر على ComplianceCase نفسه (نفس تعليق seed.ts)، لكن نفس المنطق ده مُطبَّق فعليًا على
 * Document/DocumentPackage (وحدة 4) اللي تابعين لصفقة بالظبط زي كده — الفحص ده كان ناقص هنا
 * بالكامل (اتكشف في مراجعة وحدة 5، 6 سبتمبر): SalesManager عنده Team scope حقيقي على كل موارد
 * الامتثال، وبلا الفحص ده كان يقدر يتعامل مع ملف امتثال/بوابة/إثبات منشأ لأي صفقة في المنظمة
 * كلها، مش بس صفقات فريقه — نفس فئة الثغرة المكتشفة والمُصلَحة في وحدة 2. */
async function assertDealOwnScope(scope: Awaited<ReturnType<typeof requirePermission>>, dealId: string, user: Awaited<ReturnType<typeof requireCurrentUser>>) {
  const scopedPrisma = await getScopedPrisma();
  const deal = await scopedPrisma.deal.findUniqueOrThrow({ where: { id: dealId }, include: { opportunity: { select: { ownerId: true } } } });
  await assertOwnScope(scope, deal.opportunity.ownerId, user);
}

async function assertComplianceCaseOwnScope(scope: Awaited<ReturnType<typeof requirePermission>>, complianceCaseId: string, user: Awaited<ReturnType<typeof requireCurrentUser>>) {
  const scopedPrisma = await getScopedPrisma();
  const kase = await scopedPrisma.complianceCase.findUniqueOrThrow({ where: { id: complianceCaseId }, select: { dealId: true } });
  await assertDealOwnScope(scope, kase.dealId, user);
}

const OPERATION_TYPES = ["CommercialExport", "Sample", "Tender", "TrialShipment", "AnnualContract", "PrivateLabel"] as const;

const ComplianceCaseSchema = z.object({
  operationType: z.enum(OPERATION_TYPES),
  supplierId: z.string().uuid().optional().or(z.literal("")),
});

export type ComplianceCaseFormState = { errors?: Record<string, string[]>; formError?: string };

/** بينشئ ملف امتثال لسيناريو صفقة معتمد — productId/marketId بتتشتق من الصفقة نفسها، مش إدخال مستخدم. */
export async function createComplianceCase(
  dealId: string,
  scenarioId: string,
  _prevState: ComplianceCaseFormState,
  formData: FormData
): Promise<ComplianceCaseFormState> {
  const parsed = ComplianceCaseSchema.safeParse({
    operationType: formData.get("operationType"),
    supplierId: formData.get("supplierId") || undefined,
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const user = await requireCurrentUser();
  let caseId: string;
  try {
    const scope = await requirePermission(user.roleId, "ComplianceCase", "Create");
    await assertDealOwnScope(scope, dealId, user);
    const scopedPrisma = await getScopedPrisma();
    const deal = await scopedPrisma.deal.findUniqueOrThrow({ where: { id: dealId } });

    // supplierId اختياري جاي من الفورم — لازم يتأكد إنه فعلًا بتاع نفس المنظمة قبل الإنشاء، نفس
    // فئة الفحوصات المُضافة في باقي الوحدات لكل FK اختياري من الفورم (اتكشف في إعادة مراجعة
    // وحدة 5، 7 سبتمبر — الملف ده بالكامل كان فيه نفس الفجوة على أغلب الدوال، راجع BACKLOG.md).
    if (parsed.data.supplierId) {
      const supplier = await scopedPrisma.supplier.findFirst({ where: { id: parsed.data.supplierId, deletedAt: null } });
      if (!supplier) return { formError: "المورّد غير موجود." };
    }

    caseId = await withScopedTransaction(async (tx) => {
      const kase = await tx.complianceCase.create({
        data: {
          orgId: user.orgId,
          dealId,
          scenarioId,
          productId: deal.productId,
          marketId: deal.marketId,
          supplierId: parsed.data.supplierId || undefined,
          operationType: parsed.data.operationType,
        },
      });
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "complianceCase.created",
        entityType: "ComplianceCase",
        entityId: kase.id,
        afterValue: { dealId, scenarioId, operationType: parsed.data.operationType, supplierId: parsed.data.supplierId || undefined },
      });
      return kase.id;
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "createComplianceCase", error: e });
    return { formError: "حصل خطأ أثناء فتح ملف الامتثال — حاول تاني." };
  }

  revalidatePath(`/deals/${dealId}/scenarios/${scenarioId}`);
  redirect(`/compliance/${caseId}`);
}

const REQUIREMENT_CATEGORIES = [
  "MarketAccess", "Customs", "Health", "Phytosanitary", "Quality", "Packaging", "Labeling", "Origin", "Transport", "Banking",
] as const;
const REQUIREMENT_STATUSES = [
  "NotApplicable", "Applicable", "PossiblyApplicable", "Met", "PartiallyMet", "NotMet", "Blocking", "NeedsExpertReview",
] as const;

const RequirementSchema = z
  .object({
    complianceCaseId: z.string().uuid().optional().or(z.literal("")),
    productId: z.string().uuid().optional().or(z.literal("")),
    marketId: z.string().uuid().optional().or(z.literal("")),
    category: z.enum(REQUIREMENT_CATEGORIES),
    name: z.string().trim().min(2, "اسم المتطلب مطلوب"),
    mandatory: z.coerce.boolean().optional(),
    responsibleParty: z.string().trim().optional().or(z.literal("")),
    issuingAuthority: z.string().trim().optional().or(z.literal("")),
  })
  .refine((v) => Boolean(v.complianceCaseId) || (Boolean(v.productId) && Boolean(v.marketId)), {
    message: "لازم إما ملف امتثال، أو منتج+سوق (بحث مبكر) — راجع docs/ERD.md §8.",
    path: ["complianceCaseId"],
  });

export type RequirementFormState = { errors?: Record<string, string[]>; formError?: string };

/**
 * وضعين: مرتبط بملف امتثال (complianceCaseId)، أو بحث مبكر بمنتج/سوق قبل وجود صفقة أصلًا
 * (productId+marketId بلا complianceCaseId) — راجع docs/ERD.md §8 ملاحظة 🆕v3.1.
 */
export async function createRequirement(
  _prevState: RequirementFormState,
  formData: FormData
): Promise<RequirementFormState> {
  const parsed = RequirementSchema.safeParse({
    complianceCaseId: formData.get("complianceCaseId") || undefined,
    productId: formData.get("productId") || undefined,
    marketId: formData.get("marketId") || undefined,
    category: formData.get("category"),
    name: formData.get("name"),
    mandatory: formData.get("mandatory") === "on",
    responsibleParty: formData.get("responsibleParty") || undefined,
    issuingAuthority: formData.get("issuingAuthority") || undefined,
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const user = await requireCurrentUser();
  const { complianceCaseId, productId, marketId, mandatory, responsibleParty, issuingAuthority, ...rest } = parsed.data;
  try {
    const scope = await requirePermission(user.roleId, "Requirement", "Create");
    if (complianceCaseId) {
      await assertComplianceCaseOwnScope(scope, complianceCaseId, user);
    }
    // productId/marketId (وضع البحث المبكر) جايين من الفورم — لازم يتأكدوا إنهم بتوع نفس المنظمة
    // قبل الإنشاء (اتكشف في إعادة مراجعة وحدة 5، 7 سبتمبر).
    const scopedPrisma = await getScopedPrisma();
    if (productId) {
      const product = await scopedPrisma.product.findFirst({ where: { id: productId, deletedAt: null } });
      if (!product) return { formError: "المنتج غير موجود." };
    }
    if (marketId) {
      const market = await scopedPrisma.market.findFirst({ where: { id: marketId, deletedAt: null } });
      if (!market) return { formError: "السوق غير موجود." };
    }
    await withScopedTransaction(async (tx) => {
      const requirement = await tx.requirement.create({
        data: {
          orgId: user.orgId,
          complianceCaseId: complianceCaseId || undefined,
          productId: productId || undefined,
          marketId: marketId || undefined,
          mandatory: mandatory ?? true,
          responsibleParty: responsibleParty || undefined,
          issuingAuthority: issuingAuthority || undefined,
          ...rest,
        },
      });
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "requirement.created",
        entityType: "Requirement",
        entityId: requirement.id,
        afterValue: { complianceCaseId: complianceCaseId || null, productId: productId || null, marketId: marketId || null, ...rest },
      });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "createRequirement", error: e });
    return { formError: "حصل خطأ أثناء إضافة المتطلب — حاول تاني." };
  }

  if (complianceCaseId) revalidatePath(`/compliance/${complianceCaseId}`);
  revalidatePath("/compliance/requirements");
  return {};
}

const UpdateRequirementStatusSchema = z.object({ status: z.enum(REQUIREMENT_STATUSES) });

export type UpdateRequirementStatusState = { formError?: string };

export async function updateRequirementStatus(
  requirementId: string,
  complianceCaseId: string,
  _prevState: UpdateRequirementStatusState,
  formData: FormData
): Promise<UpdateRequirementStatusState> {
  const parsed = UpdateRequirementStatusSchema.safeParse({ status: formData.get("status") });
  if (!parsed.success) return { formError: "حالة غير صالحة." };

  const user = await requireCurrentUser();
  try {
    const scope = await requirePermission(user.roleId, "Requirement", "Edit");
    // بنفحص ملكية الصفقة عبر complianceCaseId الحقيقي بتاع المتطلب نفسه (لو موجود) — مش
    // الباراميتر المُرسَل. متطلب في وضع البحث المبكر (productId+marketId بلا complianceCaseId)
    // مفيش صفقة يتفحص ضدها أصلًا.
    const scopedPrisma = await getScopedPrisma();
    const existingRequirement = await scopedPrisma.requirement.findUniqueOrThrow({ where: { id: requirementId }, select: { complianceCaseId: true } });
    if (existingRequirement.complianceCaseId) {
      await assertComplianceCaseOwnScope(scope, existingRequirement.complianceCaseId, user);
    }
    await withScopedTransaction(async (tx) => {
      const before = await tx.requirement.findUniqueOrThrow({ where: { id: requirementId } });
      await tx.requirement.update({ where: { id: requirementId }, data: { status: parsed.data.status } });
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "requirement.statusUpdated",
        entityType: "Requirement",
        entityId: requirementId,
        beforeValue: { status: before.status },
        afterValue: { status: parsed.data.status },
      });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "updateRequirementStatus", error: e });
    return { formError: "حصل خطأ أثناء تحديث حالة المتطلب — حاول تاني." };
  }

  revalidatePath(`/compliance/${complianceCaseId}`);
  return {};
}

const GateSchema = z.object({
  gateNumber: z.coerce.number().int().min(1, "لازم يكون بين 1 و12").max(12, "لازم يكون بين 1 و12"),
  gateName: z.string().trim().min(2, "اسم البوابة مطلوب"),
  blockingRequirementIds: z.array(z.string().uuid()).optional(),
  requiresOriginProofVerification: z.coerce.boolean().optional(),
  requiresAciVerification: z.coerce.boolean().optional(),
});

export type GateFormState = { errors?: Record<string, string[]>; formError?: string };

export async function createGate(
  complianceCaseId: string,
  _prevState: GateFormState,
  formData: FormData
): Promise<GateFormState> {
  const parsed = GateSchema.safeParse({
    gateNumber: formData.get("gateNumber"),
    gateName: formData.get("gateName"),
    blockingRequirementIds: formData.getAll("blockingRequirementIds"),
    requiresOriginProofVerification: formData.get("requiresOriginProofVerification") === "on",
    requiresAciVerification: formData.get("requiresAciVerification") === "on",
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const user = await requireCurrentUser();
  try {
    const scope = await requirePermission(user.roleId, "Gate", "Create");
    await assertComplianceCaseOwnScope(scope, complianceCaseId, user);
    await withScopedTransaction(async (tx) => {
      const gate = await tx.gate.create({
        data: {
          orgId: user.orgId,
          complianceCaseId,
          gateNumber: parsed.data.gateNumber,
          gateName: parsed.data.gateName,
          blockingRequirementIds: parsed.data.blockingRequirementIds ?? [],
          requiresOriginProofVerification: parsed.data.requiresOriginProofVerification ?? false,
          requiresAciVerification: parsed.data.requiresAciVerification ?? false,
        },
      });
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "gate.created",
        entityType: "Gate",
        entityId: gate.id,
        afterValue: { complianceCaseId, gateNumber: parsed.data.gateNumber, gateName: parsed.data.gateName },
      });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "createGate", error: e });
    if (e instanceof Error && e.message.includes("Unique constraint")) {
      return { formError: "في بوابة بنفس الرقم ده في الملف بالفعل." };
    }
    return { formError: "حصل خطأ أثناء إضافة البوابة — حاول تاني." };
  }

  revalidatePath(`/compliance/${complianceCaseId}`);
  return {};
}

const DIRECT_GATE_STATUSES = ["Passed", "PassedWithConditions", "Failed", "NotApplicable"] as const;
const DecideGateSchema = z.object({ status: z.enum(DIRECT_GATE_STATUSES) });

export type DecideGateState = { formError?: string };

/** قرار مباشر بلا استثناء — Waived بيمرّ عبر requestGateWaiver+اعتماد /approvals، مش هنا. */
export async function decideGate(
  gateId: string,
  complianceCaseId: string,
  _prevState: DecideGateState,
  formData: FormData
): Promise<DecideGateState> {
  const parsed = DecideGateSchema.safeParse({ status: formData.get("status") });
  if (!parsed.success) return { formError: "حالة غير صالحة." };

  const user = await requireCurrentUser();
  try {
    const scope = await requirePermission(user.roleId, "Gate", "Edit");
    // بنفحص ملكية البوابة نفسها (عبر complianceCase الحقيقي بتاعها)، مش complianceCaseId المُرسَل
    // كباراميتر — عشان محدش يقدر "يقرض" ملكية ملف امتثال يملكه عشان يعدّي فحص الملكية بينما
    // فعليًا بيعدّل بوابة تابعة لملف امتثال تاني (نفس فئة باگ createNegotiationRound في وحدة 3).
    const scopedPrisma = await getScopedPrisma();
    const gate = await scopedPrisma.gate.findUniqueOrThrow({ where: { id: gateId }, select: { complianceCaseId: true } });
    await assertComplianceCaseOwnScope(scope, gate.complianceCaseId, user);
    await withScopedTransaction(async (tx) => {
      await tx.gate.update({
        where: { id: gateId },
        data: { status: parsed.data.status, decidedBy: user.id, decidedAt: new Date() },
      });
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "gate.decided",
        entityType: "Gate",
        entityId: gateId,
        afterValue: { status: parsed.data.status },
      });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "decideGate", error: e });
    // ⚠️ متعمّد ما بنرجعش e.message هنا — Prisma بيغلّف رسالة الـTrigger جوه نص مطوّل فيه
    // مسار الملف والاستعلام الخام، ورسالة نضيفة يدوية زي دي أأمن (نفس نمط createQuote/walkAwayPrice).
    if (e instanceof Error && e.message.includes("متطلب حاجب")) {
      return { formError: "مينفعش تعدّي البوابة دي — لسه فيه متطلبات حاجبة مش مستوفاة (Met/غير منطبق)." };
    }
    if (e instanceof Error && e.message.includes("revised rules")) {
      return {
        formError:
          'مينفعش تعدّي بوابة الشحن دي — فيه إثبات منشأ بيستخدم قواعد PEM المنقّحة بس عبارة "revised rules" الإلزامية لسه مش متحقّق منها.',
      };
    }
    if (e instanceof Error && e.message.includes("مهلة تصدير ACID")) {
      return {
        formError: "مينفعش تعدّي بوابة الشحن دي — فيه شحنة مرتبطة لسه ما استوفتش مهلة تصدير ACID الإلزامية (48 ساعة قبل المغادرة).",
      };
    }
    return { formError: "حصل خطأ أثناء تسجيل قرار البوابة — حاول تاني." };
  }

  revalidatePath(`/compliance/${complianceCaseId}`);
  return {};
}

export type RequestGateWaiverState = { formError?: string };

/** بيحجز طلب موافقة استثنائية (Approval.subjectType='Gate.waiver') — الاعتماد الفعلي من /approvals،
 * الـTrigger (gate_waiver_requires_approval) مش هيسمح بـstatus=Waived غير بعد اعتماد حقيقي. */
export async function requestGateWaiver(
  gateId: string,
  complianceCaseId: string,
  _prevState: RequestGateWaiverState
): Promise<RequestGateWaiverState> {
  const user = await requireCurrentUser();
  try {
    const scope = await requirePermission(user.roleId, "Gate", "Edit");
    const scopedPrisma = await getScopedPrisma();
    const existingPending = await scopedPrisma.approval.findFirst({
      where: { orgId: user.orgId, subjectType: "Gate.waiver", subjectId: gateId, decision: "Pending" },
    });
    if (existingPending) return { formError: "في طلب تجاوز معلّق بالفعل لهذه البوابة." };

    const gate = await scopedPrisma.gate.findUniqueOrThrow({
      where: { id: gateId },
      include: { complianceCase: { include: { deal: { include: { opportunity: { select: { ownerId: true } } } } } } },
    });
    await assertOwnScope(scope, gate.complianceCase.deal.opportunity.ownerId, user);

    await withScopedTransaction(async (tx) => {
      const approval = await tx.approval.create({
        data: {
          orgId: user.orgId,
          subjectType: "Gate.waiver",
          subjectId: gateId,
          requestedBy: user.id,
          payload: {
            dealId: gate.complianceCase.dealId,
            complianceCaseId: gate.complianceCase.id,
            gateName: gate.gateName,
          },
        },
      });
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "gate.waiverRequested",
        entityType: "Gate",
        entityId: gateId,
        afterValue: { approvalId: approval.id },
      });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "requestGateWaiver", error: e });
    return { formError: "حصل خطأ أثناء إرسال طلب التجاوز — حاول تاني." };
  }

  revalidatePath(`/compliance/${complianceCaseId}`);
  revalidatePath("/approvals");
  return {};
}

const HS_STATUSES = [
  "Proposed", "UnderReview", "ConfirmedInternally", "ConfirmedByBroker", "ConfirmedByRuling", "Disputed", "NeedsExpertReview", "Rejected",
] as const;

const HSClassificationSchema = z.object({
  productId: z.string().uuid("اختر منتج"),
  marketId: z.string().uuid("اختر سوق"),
  hsCode: z.string().trim().min(4, "HS Code غير صالح"),
  status: z.enum(HS_STATUSES),
  dutyRatePct: z.coerce.number().min(0).max(100).optional(),
  rulingReference: z.string().trim().optional().or(z.literal("")),
});

export type HSClassificationFormState = { errors?: Record<string, string[]>; formError?: string };

export async function createHSClassification(
  complianceCaseId: string,
  _prevState: HSClassificationFormState,
  formData: FormData
): Promise<HSClassificationFormState> {
  const parsed = HSClassificationSchema.safeParse({
    productId: formData.get("productId"),
    marketId: formData.get("marketId"),
    hsCode: formData.get("hsCode"),
    status: formData.get("status"),
    dutyRatePct: formData.get("dutyRatePct") || undefined,
    rulingReference: formData.get("rulingReference") || undefined,
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const user = await requireCurrentUser();
  const { rulingReference, ...rest } = parsed.data;
  try {
    await requirePermission(user.roleId, "HSClassification", "Create");
    // productId/marketId إلزاميين جايين من الفورم — لازم يتأكدوا إنهم بتوع نفس المنظمة قبل
    // الإنشاء (اتكشف في إعادة مراجعة وحدة 5، 7 سبتمبر). ⚠️ مش Promise.all — راجع BACKLOG.md (P2028).
    const scopedPrisma = await getScopedPrisma();
    const product = await scopedPrisma.product.findFirst({ where: { id: rest.productId, deletedAt: null } });
    if (!product) return { formError: "المنتج غير موجود." };
    const market = await scopedPrisma.market.findFirst({ where: { id: rest.marketId, deletedAt: null } });
    if (!market) return { formError: "السوق غير موجود." };
    await withScopedTransaction(async (tx) => {
      const hs = await tx.hSClassification.create({
        data: { orgId: user.orgId, rulingReference: rulingReference || undefined, ...rest },
      });
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "hsClassification.created",
        entityType: "HSClassification",
        entityId: hs.id,
        afterValue: rest,
      });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "createHSClassification", error: e });
    return { formError: "حصل خطأ أثناء إضافة التصنيف الجمركي — حاول تاني." };
  }

  revalidatePath(`/compliance/${complianceCaseId}`);
  return {};
}

const CERTIFICATE_TYPES = [
  "HACCP", "BRCGS", "IFS", "FSSC", "GlobalGAP", "ISO", "Organic", "Halal", "Kosher", "GMP", "Phytosanitary", "HealthCertificate", "COA", "Fumigation",
] as const;
const CERTIFICATE_STATUSES = [
  "Valid", "ExpiringSoon", "Expired", "Suspended", "UnderRenewal", "Pending", "Rejected", "NotVerified",
] as const;

const CertificateSchema = z.object({
  companyId: z.string().uuid().optional().or(z.literal("")),
  productId: z.string().uuid().optional().or(z.literal("")),
  supplierId: z.string().uuid().optional().or(z.literal("")),
  facilityId: z.string().uuid().optional().or(z.literal("")),
  certificateType: z.enum(CERTIFICATE_TYPES),
  certificateNumber: z.string().trim().min(1, "رقم الشهادة مطلوب"),
  issuingAuthority: z.string().trim().min(1, "الجهة المُصدرة مطلوبة"),
  issueDate: z.string().trim().min(1, "تاريخ الإصدار مطلوب"),
  expiryDate: z.string().trim().optional().or(z.literal("")),
  status: z.enum(CERTIFICATE_STATUSES),
});

export type CertificateFormState = { errors?: Record<string, string[]>; formError?: string };

export async function createCertificate(
  complianceCaseId: string,
  _prevState: CertificateFormState,
  formData: FormData
): Promise<CertificateFormState> {
  const parsed = CertificateSchema.safeParse({
    companyId: formData.get("companyId") || undefined,
    productId: formData.get("productId") || undefined,
    supplierId: formData.get("supplierId") || undefined,
    facilityId: formData.get("facilityId") || undefined,
    certificateType: formData.get("certificateType"),
    certificateNumber: formData.get("certificateNumber"),
    issuingAuthority: formData.get("issuingAuthority"),
    issueDate: formData.get("issueDate"),
    expiryDate: formData.get("expiryDate") || undefined,
    status: formData.get("status"),
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const user = await requireCurrentUser();
  const { companyId, productId, supplierId, facilityId, issueDate, expiryDate, ...rest } = parsed.data;
  try {
    await requirePermission(user.roleId, "Certificate", "Create");
    // كل الـFKs الأربعة اختياريين جايين من الفورم — لازم يتأكدوا إنهم بتوع نفس المنظمة قبل
    // الإنشاء (اتكشف في إعادة مراجعة وحدة 5، 7 سبتمبر). ⚠️ مش Promise.all — راجع BACKLOG.md (P2028).
    const scopedPrisma = await getScopedPrisma();
    if (companyId) {
      const company = await scopedPrisma.company.findFirst({ where: { id: companyId, deletedAt: null } });
      if (!company) return { formError: "الشركة غير موجودة." };
    }
    if (productId) {
      const product = await scopedPrisma.product.findFirst({ where: { id: productId, deletedAt: null } });
      if (!product) return { formError: "المنتج غير موجود." };
    }
    if (supplierId) {
      const supplier = await scopedPrisma.supplier.findFirst({ where: { id: supplierId, deletedAt: null } });
      if (!supplier) return { formError: "المورّد غير موجود." };
    }
    if (facilityId) {
      const facility = await scopedPrisma.facility.findFirst({ where: { id: facilityId } });
      if (!facility) return { formError: "المنشأة غير موجودة." };
    }
    await withScopedTransaction(async (tx) => {
      const cert = await tx.certificate.create({
        data: {
          orgId: user.orgId,
          companyId: companyId || undefined,
          productId: productId || undefined,
          supplierId: supplierId || undefined,
          facilityId: facilityId || undefined,
          issueDate: new Date(issueDate),
          expiryDate: expiryDate ? new Date(expiryDate) : undefined,
          marketsCovered: [],
          ...rest,
        },
      });
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "certificate.created",
        entityType: "Certificate",
        entityId: cert.id,
        afterValue: { companyId: companyId || null, productId: productId || null, supplierId: supplierId || null, facilityId: facilityId || null, ...rest },
      });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "createCertificate", error: e });
    return { formError: "حصل خطأ أثناء إضافة الشهادة — حاول تاني." };
  }

  revalidatePath(`/compliance/${complianceCaseId}`);
  return {};
}

const REGISTRATION_TYPES = [
  "FacilityRegistration", "ProductRegistration", "ExporterRegistration", "ImporterRegistration", "LabelRegistration",
] as const;
const REGISTRATION_STATUSES = [
  "NotStarted", "CollectingDocuments", "Submitted", "UnderReview", "InspectionRequired", "Approved", "Rejected", "Expired", "Suspended", "RenewalRequired",
] as const;

const RegistrationSchema = z.object({
  registrationType: z.enum(REGISTRATION_TYPES),
  country: z.string().trim().min(1, "الدولة مطلوبة"),
  authority: z.string().trim().min(1, "الجهة المختصة مطلوبة"),
  productId: z.string().uuid().optional().or(z.literal("")),
  supplierId: z.string().uuid().optional().or(z.literal("")),
  facilityId: z.string().uuid().optional().or(z.literal("")),
  registrationNumber: z.string().trim().optional().or(z.literal("")),
  submissionDate: z.string().trim().optional().or(z.literal("")),
  approvalDate: z.string().trim().optional().or(z.literal("")),
  expiryDate: z.string().trim().optional().or(z.literal("")),
  status: z.enum(REGISTRATION_STATUSES),
});

export type RegistrationFormState = { errors?: Record<string, string[]>; formError?: string };

export async function createRegistration(
  complianceCaseId: string,
  _prevState: RegistrationFormState,
  formData: FormData
): Promise<RegistrationFormState> {
  const parsed = RegistrationSchema.safeParse({
    registrationType: formData.get("registrationType"),
    country: formData.get("country"),
    authority: formData.get("authority"),
    productId: formData.get("productId") || undefined,
    supplierId: formData.get("supplierId") || undefined,
    facilityId: formData.get("facilityId") || undefined,
    registrationNumber: formData.get("registrationNumber") || undefined,
    submissionDate: formData.get("submissionDate") || undefined,
    approvalDate: formData.get("approvalDate") || undefined,
    expiryDate: formData.get("expiryDate") || undefined,
    status: formData.get("status"),
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const user = await requireCurrentUser();
  const { productId, supplierId, facilityId, registrationNumber, submissionDate, approvalDate, expiryDate, ...rest } = parsed.data;
  try {
    await requirePermission(user.roleId, "Registration", "Create");
    // الثلاثة FKs اختياريين جايين من الفورم — لازم يتأكدوا إنهم بتوع نفس المنظمة قبل الإنشاء
    // (اتكشف في إعادة مراجعة وحدة 5، 7 سبتمبر). ⚠️ مش Promise.all — راجع BACKLOG.md (P2028).
    const scopedPrisma = await getScopedPrisma();
    if (productId) {
      const product = await scopedPrisma.product.findFirst({ where: { id: productId, deletedAt: null } });
      if (!product) return { formError: "المنتج غير موجود." };
    }
    if (supplierId) {
      const supplier = await scopedPrisma.supplier.findFirst({ where: { id: supplierId, deletedAt: null } });
      if (!supplier) return { formError: "المورّد غير موجود." };
    }
    if (facilityId) {
      const facility = await scopedPrisma.facility.findFirst({ where: { id: facilityId } });
      if (!facility) return { formError: "المنشأة غير موجودة." };
    }
    await withScopedTransaction(async (tx) => {
      const registration = await tx.registration.create({
        data: {
          orgId: user.orgId,
          productId: productId || undefined,
          supplierId: supplierId || undefined,
          facilityId: facilityId || undefined,
          registrationNumber: registrationNumber || undefined,
          submissionDate: submissionDate ? new Date(submissionDate) : undefined,
          approvalDate: approvalDate ? new Date(approvalDate) : undefined,
          expiryDate: expiryDate ? new Date(expiryDate) : undefined,
          ...rest,
        },
      });
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "registration.created",
        entityType: "Registration",
        entityId: registration.id,
        afterValue: { productId: productId || null, supplierId: supplierId || null, facilityId: facilityId || null, ...rest },
      });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "createRegistration", error: e });
    return { formError: "حصل خطأ أثناء إضافة التسجيل — حاول تاني." };
  }

  revalidatePath(`/compliance/${complianceCaseId}`);
  return {};
}

const ORIGIN_PROOF_TYPES = ["EUR1", "InvoiceDeclaration", "StatementOnOrigin", "CertificateOfOrigin"] as const;
const ORIGIN_PROOF_CUMULATION_TYPES = ["None", "Bilateral", "Diagonal", "Full"] as const;
const ORIGIN_PROOF_STATUSES = ["Draft", "Issued", "Verified", "Rejected", "Expired"] as const;

const OriginProofSchema = z.object({
  proofType: z.enum(ORIGIN_PROOF_TYPES),
  shipmentId: z.string().uuid().optional().or(z.literal("")),
  usesRevisedPemRules: z.coerce.boolean().optional(),
  revisedRulesWordingVerified: z.coerce.boolean().optional(),
  cumulationType: z.enum(ORIGIN_PROOF_CUMULATION_TYPES).optional().or(z.literal("")),
  certificateNumber: z.string().trim().optional().or(z.literal("")),
  issuedDate: z.string().trim().optional().or(z.literal("")),
  issuingAuthority: z.string().trim().optional().or(z.literal("")),
  status: z.enum(ORIGIN_PROOF_STATUSES),
});

export type OriginProofFormState = { errors?: Record<string, string[]>; formError?: string };

export async function createOriginProof(
  complianceCaseId: string,
  dealId: string,
  _prevState: OriginProofFormState,
  formData: FormData
): Promise<OriginProofFormState> {
  const parsed = OriginProofSchema.safeParse({
    proofType: formData.get("proofType"),
    shipmentId: formData.get("shipmentId") || undefined,
    usesRevisedPemRules: formData.get("usesRevisedPemRules") === "on",
    revisedRulesWordingVerified: formData.get("revisedRulesWordingVerified") === "on",
    cumulationType: formData.get("cumulationType") || undefined,
    certificateNumber: formData.get("certificateNumber") || undefined,
    issuedDate: formData.get("issuedDate") || undefined,
    issuingAuthority: formData.get("issuingAuthority") || undefined,
    status: formData.get("status"),
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const user = await requireCurrentUser();
  const { shipmentId, cumulationType, certificateNumber, issuedDate, issuingAuthority, ...rest } = parsed.data;
  try {
    const scope = await requirePermission(user.roleId, "OriginProof", "Create");
    await assertDealOwnScope(scope, dealId, user);
    // shipmentId اختياري جاي من الفورم — لازم يتأكد إنه فعلًا بتاع نفس المنظمة قبل الإنشاء
    // (اتكشف في إعادة مراجعة وحدة 5، 7 سبتمبر).
    if (shipmentId) {
      const scopedPrisma = await getScopedPrisma();
      const shipment = await scopedPrisma.shipment.findFirst({ where: { id: shipmentId } });
      if (!shipment) return { formError: "الشحنة غير موجودة." };
    }
    await withScopedTransaction(async (tx) => {
      const proof = await tx.originProof.create({
        data: {
          orgId: user.orgId,
          dealId,
          shipmentId: shipmentId || undefined,
          cumulationType: cumulationType || undefined,
          certificateNumber: certificateNumber || undefined,
          issuedDate: issuedDate ? new Date(issuedDate) : undefined,
          issuingAuthority: issuingAuthority || undefined,
          ...rest,
        },
      });
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "originProof.created",
        entityType: "OriginProof",
        entityId: proof.id,
        afterValue: { dealId, shipmentId: shipmentId || null, cumulationType: cumulationType || null, ...rest },
      });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "createOriginProof", error: e });
    return { formError: "حصل خطأ أثناء إضافة إثبات المنشأ — حاول تاني." };
  }

  revalidatePath(`/compliance/${complianceCaseId}`);
  return {};
}

const OriginProofUpdateSchema = z.object({
  revisedRulesWordingVerified: z.coerce.boolean().optional(),
  cumulationType: z.enum(ORIGIN_PROOF_CUMULATION_TYPES).optional().or(z.literal("")),
  certificateNumber: z.string().trim().optional().or(z.literal("")),
  issuedDate: z.string().trim().optional().or(z.literal("")),
  issuingAuthority: z.string().trim().optional().or(z.literal("")),
  status: z.enum(ORIGIN_PROOF_STATUSES),
});

export type OriginProofUpdateFormState = { errors?: Record<string, string[]>; formError?: string };

/** ⚠️ عيب اتلقط في المراجعة (BACKLOG.md، 30 أغسطس): `createOriginProof` بس كان موجود، ومفيش
 * فورم تعديل بعد الإصدار الأول — بينما `revisedRulesWordingVerified` عمليًا بيتحدَّث بعد الإصدار
 * (المستند بيتراجع/يتحقق منه لاحقًا، مش وقت الإنشاء)، وده بالظبط الحقل اللي Trigger
 * enforce_gate_origin_proof_verified بيقفل بيه بوابات الشحن. حقول هيكلية (proofType/dealId/
 * shipmentId/usesRevisedPemRules) مش قابلة للتعديل هنا عمدًا — لو غلط، إثبات جديد مش تعديل. */
export async function updateOriginProofAction(
  complianceCaseId: string,
  originProofId: string,
  _prevState: OriginProofUpdateFormState,
  formData: FormData
): Promise<OriginProofUpdateFormState> {
  const parsed = OriginProofUpdateSchema.safeParse({
    revisedRulesWordingVerified: formData.get("revisedRulesWordingVerified") === "on",
    cumulationType: formData.get("cumulationType") || undefined,
    certificateNumber: formData.get("certificateNumber") || undefined,
    issuedDate: formData.get("issuedDate") || undefined,
    issuingAuthority: formData.get("issuingAuthority") || undefined,
    status: formData.get("status"),
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const user = await requireCurrentUser();
  const { cumulationType, certificateNumber, issuedDate, issuingAuthority, ...rest } = parsed.data;
  try {
    const scope = await requirePermission(user.roleId, "OriginProof", "Edit");
    // بنفحص ملكية إثبات المنشأ نفسه عبر dealId الحقيقي بتاعه، مش الباراميتر complianceCaseId
    // المُرسَل (نفس السبب الموضّح في decideGate فوق).
    const scopedPrisma = await getScopedPrisma();
    const existingProof = await scopedPrisma.originProof.findUniqueOrThrow({ where: { id: originProofId }, select: { dealId: true } });
    await assertDealOwnScope(scope, existingProof.dealId, user);
    await withScopedTransaction(async (tx) => {
      const before = await tx.originProof.findUniqueOrThrow({ where: { id: originProofId } });
      await tx.originProof.update({
        where: { id: originProofId },
        data: {
          cumulationType: cumulationType || null,
          certificateNumber: certificateNumber || null,
          issuedDate: issuedDate ? new Date(issuedDate) : null,
          issuingAuthority: issuingAuthority || null,
          ...rest,
        },
      });
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "originProof.updated",
        entityType: "OriginProof",
        entityId: originProofId,
        beforeValue: { revisedRulesWordingVerified: before.revisedRulesWordingVerified, status: before.status },
        afterValue: { ...rest, cumulationType: cumulationType || null },
      });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "updateOriginProofAction", error: e });
    return { formError: "حصل خطأ أثناء تحديث إثبات المنشأ — حاول تاني." };
  }

  revalidatePath(`/compliance/${complianceCaseId}`);
  return {};
}

const REJECTION_TYPES = [
  "DocumentRejection", "SampleRejection", "TestFailure", "LabelRejection", "CustomsHold", "OriginRejection", "HSDispute", "HealthRejection", "WeightMismatch",
] as const;
const REJECTION_SEVERITIES = ["Low", "Medium", "High", "Critical"] as const;

const RejectionCaseSchema = z.object({
  rejectionType: z.enum(REJECTION_TYPES),
  capaId: z.string().uuid().optional().or(z.literal("")),
  shipmentId: z.string().uuid().optional().or(z.literal("")),
  authority: z.string().trim().min(1, "الجهة مطلوبة"),
  severity: z.enum(REJECTION_SEVERITIES),
  financialExposure: z.coerce.number().min(0).optional(),
  currency: z.string().trim().optional().or(z.literal("")),
  finalResult: z.string().trim().optional().or(z.literal("")),
});

export type RejectionCaseFormState = { errors?: Record<string, string[]>; formError?: string };

export async function createRejectionCase(
  complianceCaseId: string,
  _prevState: RejectionCaseFormState,
  formData: FormData
): Promise<RejectionCaseFormState> {
  const parsed = RejectionCaseSchema.safeParse({
    rejectionType: formData.get("rejectionType"),
    capaId: formData.get("capaId") || undefined,
    shipmentId: formData.get("shipmentId") || undefined,
    authority: formData.get("authority"),
    severity: formData.get("severity"),
    financialExposure: formData.get("financialExposure") || undefined,
    currency: formData.get("currency") || undefined,
    finalResult: formData.get("finalResult") || undefined,
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const user = await requireCurrentUser();
  const { capaId, shipmentId, currency, finalResult, ...rest } = parsed.data;
  try {
    const scope = await requirePermission(user.roleId, "RejectionCase", "Create");
    await assertComplianceCaseOwnScope(scope, complianceCaseId, user);
    // capaId/shipmentId اختياريين جايين من الفورم — لازم يتأكدوا إنهم بتوع نفس المنظمة قبل
    // الإنشاء (اتكشف في إعادة مراجعة وحدة 5، 7 سبتمبر). ⚠️ مش Promise.all — راجع BACKLOG.md (P2028).
    const scopedPrisma = await getScopedPrisma();
    if (capaId) {
      const capa = await scopedPrisma.cAPA.findFirst({ where: { id: capaId } });
      if (!capa) return { formError: "الـCAPA غير موجود." };
    }
    if (shipmentId) {
      const shipment = await scopedPrisma.shipment.findFirst({ where: { id: shipmentId } });
      if (!shipment) return { formError: "الشحنة غير موجودة." };
    }
    await withScopedTransaction(async (tx) => {
      const rejectionCase = await tx.rejectionCase.create({
        data: {
          orgId: user.orgId,
          complianceCaseId,
          capaId: capaId || undefined,
          shipmentId: shipmentId || undefined,
          currency: currency || undefined,
          finalResult: finalResult || undefined,
          ...rest,
        },
      });
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "rejectionCase.created",
        entityType: "RejectionCase",
        entityId: rejectionCase.id,
        afterValue: { complianceCaseId, ...rest },
      });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "createRejectionCase", error: e });
    return { formError: "حصل خطأ أثناء إضافة حالة الرفض — حاول تاني." };
  }

  revalidatePath(`/compliance/${complianceCaseId}`);
  return {};
}

const LCRequirementSchema = z.object({
  lcNumber: z.string().trim().min(1, "رقم خطاب الاعتماد مطلوب"),
  issuingBank: z.string().trim().min(1, "البنك المُصدر مطلوب"),
  amount: z.coerce.number().min(0, "المبلغ مطلوب"),
  currency: z.string().trim().min(1, "العملة مطلوبة"),
  expiryDate: z.string().trim().min(1, "تاريخ الانتهاء مطلوب"),
  latestShipmentDate: z.string().trim().optional().or(z.literal("")),
  presentationPeriodDays: z.coerce.number().int().min(0).optional(),
  requiredDocuments: z.array(z.string().trim().min(1)).optional(),
  requiredWording: z.string().trim().optional().or(z.literal("")),
  partialShipmentAllowed: z.coerce.boolean().optional(),
  transshipmentAllowed: z.coerce.boolean().optional(),
});

export type LCRequirementFormState = { errors?: Record<string, string[]>; formError?: string };

export async function createLCRequirement(
  complianceCaseId: string,
  dealId: string,
  _prevState: LCRequirementFormState,
  formData: FormData
): Promise<LCRequirementFormState> {
  const requiredDocumentsRaw = (formData.get("requiredDocuments") as string | null) ?? "";
  const parsed = LCRequirementSchema.safeParse({
    lcNumber: formData.get("lcNumber"),
    issuingBank: formData.get("issuingBank"),
    amount: formData.get("amount"),
    currency: formData.get("currency"),
    expiryDate: formData.get("expiryDate"),
    latestShipmentDate: formData.get("latestShipmentDate") || undefined,
    presentationPeriodDays: formData.get("presentationPeriodDays") || undefined,
    requiredDocuments: requiredDocumentsRaw
      .split(",")
      .map((d) => d.trim())
      .filter(Boolean),
    requiredWording: formData.get("requiredWording") || undefined,
    partialShipmentAllowed: formData.get("partialShipmentAllowed") === "on",
    transshipmentAllowed: formData.get("transshipmentAllowed") === "on",
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const user = await requireCurrentUser();
  const { expiryDate, latestShipmentDate, requiredWording, ...rest } = parsed.data;
  try {
    const scope = await requirePermission(user.roleId, "LCRequirement", "Create");
    await assertDealOwnScope(scope, dealId, user);
    await withScopedTransaction(async (tx) => {
      const lcRequirement = await tx.lCRequirement.create({
        data: {
          orgId: user.orgId,
          dealId,
          expiryDate: new Date(expiryDate),
          latestShipmentDate: latestShipmentDate ? new Date(latestShipmentDate) : undefined,
          requiredWording: requiredWording || undefined,
          requiredDocuments: rest.requiredDocuments ?? [],
          ...rest,
        },
      });
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "lcRequirement.created",
        entityType: "LCRequirement",
        entityId: lcRequirement.id,
        afterValue: { dealId, ...rest },
      });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "createLCRequirement", error: e });
    return { formError: "حصل خطأ أثناء إضافة متطلبات خطاب الاعتماد — حاول تاني." };
  }

  revalidatePath(`/compliance/${complianceCaseId}`);
  return {};
}
