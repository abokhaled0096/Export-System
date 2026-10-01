"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ScopedTx } from "@/lib/scoped-prisma";
import { getScopedPrisma, withScopedTransaction } from "@/lib/scoped-prisma";
import { requireCurrentUser } from "@/lib/session";
import { requirePermission, getPermissionScope } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { notifyUser, notifyChangeRequestApprovers } from "@/lib/notification";
import { logError, isNextControlFlowError, businessRuleMessage } from "@/lib/errorLog";
import { assertWorkflowTransitionAllowed } from "@/lib/workflow";
import { NEW_ENTITY_SENTINEL } from "@/lib/masterDataChangeRequest";
import { entityTypeLabel } from "@/lib/changeRequestLabels";
import { CompanySchema } from "@/lib/companySchema";
import { SupplierSchema } from "@/lib/supplierSchema";
import { BankAccountSchema } from "@/lib/bankAccountSchema";
import { ProductSchema } from "@/lib/productSchema";
import { PurchaseOrderSchema } from "@/lib/purchaseOrderSchema";
import { generatePoNumber } from "@/lib/purchaseOrder";
import { Prisma } from "@/generated/prisma/client";
import { currencySchema } from "@/lib/currencySchema";

/**
 * بيحوّل طلب إنشاء (entityId === NEW_ENTITY_SENTINEL) لكيان حقيقي وقت الاعتماد — هنا بالظبط
 * الفرق بين "بوابة فعلية" و"تسجيل شكلي بلا أثر" اللي كان موثّق في BACKLOG.md. إعادة فحص
 * proposedChanges بنفس الـSchema بتاعة الإنشاء المباشر إلزامية (defense in depth) — الـJSON ده
 * جاي من صف قاعدة بيانات مش مدخل نموذج، لكن لسه مش نوع مضمون وقت التخزين.
 *
 * ⚠️ `requestedBy` ≠ `approverId` عمدًا: صاحب الكيان (`Company.ownerId`) ومنشئه (`Supplier.createdBy`)
 * لازم يكونوا اللي طلب الإضافة أصلًا، مش المعتمِد. غلط ده كان هيبوّظ حاجتين حقيقيتين: (1) فلترة
 * Own-scope كانت هترجّع الشركة الجديدة "مش ملك" الشخص اللي هيشتغل عليها أصلًا؛ (2) قاعدة فصل
 * المهام على Supplier (راجع docs/ERD.md §12 وBACKLOG.md § خلصان) بتقارن `createdBy` بمعتمِد أول
 * دفعة — لو `createdBy` بقى المعتمِد نفسه بدل الطالب الحقيقي، القاعدة كانت هتفقد معناها الأمني
 * تمامًا (سيناريو الاحتيال اللي بتحمي منه هو "الطالب" اللي ممكن يعمل مورّد وهمي، مش المعتمِد المحايد).
 */
async function createEntityFromChangeRequest(
  tx: ScopedTx,
  orgId: string,
  requestedBy: string,
  approverId: string,
  entityType: string,
  proposedChanges: unknown
): Promise<string> {
  switch (entityType) {
    case "Company": {
      const { classification, leadSourceType, leadSourceDetail, ...rest } = CompanySchema.parse(proposedChanges);
      const company = await tx.company.create({
        data: {
          orgId,
          ...rest,
          classification: [classification],
          status: "Lead",
          ownerId: requestedBy,
          leadSourceType: leadSourceType || undefined,
          leadSourceDetail: leadSourceDetail || undefined,
          leadFoundAt: leadSourceType ? new Date() : undefined,
          // الباحث هو مقدّم الطلب مش المعتمِد — المصدر بتاعه هو.
          leadFoundBy: leadSourceType ? requestedBy : undefined,
        },
      });
      await logAudit(tx, { orgId, userId: approverId, action: "company.created", entityType: "Company", entityId: company.id, afterValue: { ...rest, source: "changeRequest", requestedBy } });
      return company.id;
    }
    case "Supplier": {
      const data = SupplierSchema.parse(proposedChanges);
      // نفس تطبيع createSupplier المباشر بالحرف: نص فاضي يتخزّن NULL مش ""، وsupplierType
      // (عمود مطلوب بلا default) بيدّيله [] لو مفيش. بلا ده، الاعتماد كان هيسيب فرق بيانات
      // ملموس عن نفس الحقول لو اتعملت بالإنشاء المباشر (عرض "" بدل "—" في أي صفحة تفاصيل).
      const supplier = await tx.supplier.create({
        data: {
          orgId,
          status: "Identified",
          ...data,
          tradeName: data.tradeName || undefined,
          country: data.country || undefined,
          governorate: data.governorate || undefined,
          city: data.city || undefined,
          taxId: data.taxId || undefined,
          commercialRegNo: data.commercialRegNo || undefined,
          supplierType: data.supplierType ?? [],
          createdBy: requestedBy,
        },
      });
      await logAudit(tx, { orgId, userId: approverId, action: "supplier.created", entityType: "Supplier", entityId: supplier.id, afterValue: { ...data, source: "changeRequest", requestedBy } });
      return supplier.id;
    }
    case "BankAccount": {
      const data = BankAccountSchema.parse(proposedChanges);
      const account = await tx.bankAccount.create({ data: { orgId, ...data } });
      await logAudit(tx, { orgId, userId: approverId, action: "bankAccount.created", entityType: "BankAccount", entityId: account.id, afterValue: { ...data, source: "changeRequest", requestedBy } });
      return account.id;
    }
    case "Product": {
      // confirmDuplicate تحذير ناعم وقت الإنشاء المباشر بس (createProduct) — مالهوش معنى وقت
      // الاعتماد، فبيتشال من الفحص أصلًا هنا بدل ما يتحقق ويتشال بعد كده.
      const data = ProductSchema.omit({ confirmDuplicate: true }).parse(proposedChanges);
      const product = await tx.product.create({
        data: { orgId, ...data, availableMonths: data.availableMonths ?? [], status: "Draft" },
      });
      await logAudit(tx, { orgId, userId: approverId, action: "product.created", entityType: "Product", entityId: product.id, afterValue: { ...data, source: "changeRequest", requestedBy } });
      return product.id;
    }
    case "PurchaseOrder": {
      // sourcingRequestId مش جزء من PurchaseOrderSchema (بيوصل كـbound argument للفعل المباشر،
      // مش حقل فورم) — لازم يتفصل قبل التحقق، ويتخزّن جوه proposedChanges عمدًا وقت الطلب
      // (راجع createPurchaseOrder في src/app/sourcing/actions.ts) عشان نعرف نربط الـPO الناتج
      // بطلب التوريد الصح وقت الاعتماد.
      const { sourcingRequestId, ...rest } = proposedChanges as { sourcingRequestId: string } & Record<string, unknown>;
      const data = PurchaseOrderSchema.parse(rest);
      const { facilityId, specificationId, paymentTerms, penalties, ...restData } = data;

      const sourcingRequest = await tx.sourcingRequest.findUniqueOrThrow({ where: { id: sourcingRequestId } });

      // فحص السقف تاني وقت الاعتماد (defense in depth) — ممكن maximumPurchasePrice يتغيّر بين
      // وقت الطلب ووقت القرار. لو فوق السقف، الـTrigger (enforce_purchase_order_max_price) هيمنع
      // الإنشاء أصلًا على مستوى القاعدة، لكن رسالة واضحة هنا أفضل من رسالة Trigger خام.
      if (new Prisma.Decimal(restData.unitPrice).greaterThan(sourcingRequest.maximumPurchasePrice)) {
        throw new Error("سعر الوحدة بقى فوق الحد الأقصى المسموح لطلب التوريد ده — ارفض الطلب واطلب تاني بسعر مختلف أو بصلاحية PurchaseOrder.Create مباشرة (تدعم موافقة استثنائية).");
      }

      const supplier = await tx.supplier.findFirst({ where: { id: restData.supplierId, deletedAt: null } });
      if (!supplier) throw new Error("المورّد غير موجود.");
      if (facilityId) {
        const facility = await tx.facility.findFirst({ where: { id: facilityId } });
        if (!facility) throw new Error("المنشأة غير موجودة.");
      }
      if (specificationId) {
        const specification = await tx.productSpecification.findFirst({ where: { id: specificationId } });
        if (!specification) throw new Error("المواصفة غير موجودة.");
      }

      const poNumber = await generatePoNumber(tx, orgId);

      const po = await tx.purchaseOrder.create({
        data: {
          orgId,
          sourcingRequestId,
          facilityId: facilityId || undefined,
          specificationId: specificationId || undefined,
          poNumber,
          paymentTerms: paymentTerms || undefined,
          penalties: penalties || undefined,
          ...restData,
        },
      });
      await tx.sourcingRequest.update({ where: { id: sourcingRequestId }, data: { status: "POIssued" } });
      await logAudit(tx, { orgId, userId: approverId, action: "purchaseOrder.created", entityType: "PurchaseOrder", entityId: po.id, afterValue: { sourcingRequestId, poNumber, ...restData, source: "changeRequest", requestedBy } });
      return po.id;
    }
    default:
      throw new Error(`اعتماد طلبات إنشاء ${entityType} مش مدعوم لسه.`);
  }
}

// ==================== SegregationOfDutyRule ====================

const SoDRuleSchema = z.object({
  action1: z.string().trim().min(1, "الفعل الأول مطلوب"),
  action2: z.string().trim().min(1, "الفعل الثاني مطلوب"),
  mustBeDifferentUser: z.coerce.boolean().default(true),
});

export type SoDRuleFormState = { errors?: Record<string, string[]>; formError?: string };

/** جدول قواعد قابل للتخصيص — القاعدة مش مفروضة إلا لو `isActive`. الإنفاذ الفعلي دلوقتي على
 * Payment.createdBy/approvedBy بس (Trigger enforce_segregation_of_duty_payment). */
export async function createSoDRule(_prevState: SoDRuleFormState, formData: FormData): Promise<SoDRuleFormState> {
  const parsed = SoDRuleSchema.safeParse({
    action1: formData.get("action1"),
    action2: formData.get("action2"),
    mustBeDifferentUser: formData.get("mustBeDifferentUser") === "on",
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const user = await requireCurrentUser();
  try {
    await requirePermission(user.roleId, "SegregationOfDutyRule", "Create");
    await withScopedTransaction(async (tx) => {
      const rule = await tx.segregationOfDutyRule.create({ data: { orgId: user.orgId, ...parsed.data } });
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "sodRule.created",
        entityType: "SegregationOfDutyRule",
        entityId: rule.id,
        afterValue: parsed.data,
      });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "createSoDRule", error: e });
    return { formError: businessRuleMessage(e, "حصل خطأ أثناء إضافة القاعدة — حاول تاني.") };
  }

  revalidatePath("/governance/sod-rules");
  return {};
}

/** تفعيل/إيقاف قاعدة — الإنفاذ الفعلي بيتشغّل/يتوقّف فورًا (الـTrigger بيقرأ isActive لحظيًا). */
export async function toggleSoDRuleAction(ruleId: string, isActive: boolean) {
  const user = await requireCurrentUser();
  await requirePermission(user.roleId, "SegregationOfDutyRule", "Create");

  try {
    await withScopedTransaction(async (tx) => {
      await tx.segregationOfDutyRule.update({ where: { id: ruleId }, data: { isActive } });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "toggleSoDRuleAction", error: e });
    throw new Error(businessRuleMessage(e, "حصل خطأ أثناء تعديل القاعدة."));
  }

  revalidatePath("/governance/sod-rules");
}

// ==================== DecisionLogEntry ====================

const DecisionSchema = z.object({
  title: z.string().trim().min(1, "العنوان مطلوب"),
  decisionDate: z.string().trim().min(1, "تاريخ القرار مطلوب"),
  decidedBy: z.string().uuid("اختر مين اتخذ القرار"),
  context: z.string().trim().optional().or(z.literal("")),
  outcome: z.string().trim().optional().or(z.literal("")),
});

export type DecisionFormState = { errors?: Record<string, string[]>; formError?: string };

/** decidedBy مش بالضرورة المستخدم الحالي — القرار ممكن يكون اتّخذه حد تاني (مدير/تنفيذي) والمستخدم
 * الحالي بيسجّله بس نيابةً عنه. بيتفحص إنه فعلًا مستخدم بنفس المنظمة قبل الإنشاء (اتكشف بمراجعة
 * كود، 8 سبتمبر — الحقل ده كان اتشال بالغلط ضمن تبسيط عام كان المفروض يقتصر على حقول status). */
export async function createDecisionLogEntry(_prevState: DecisionFormState, formData: FormData): Promise<DecisionFormState> {
  const parsed = DecisionSchema.safeParse({
    title: formData.get("title"),
    decisionDate: formData.get("decisionDate"),
    decidedBy: formData.get("decidedBy"),
    context: formData.get("context") || undefined,
    outcome: formData.get("outcome") || undefined,
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const user = await requireCurrentUser();
  const { title, decisionDate, decidedBy, context, outcome } = parsed.data;

  try {
    await requirePermission(user.roleId, "DecisionLogEntry", "Create");
    const scopedPrisma = await getScopedPrisma();
    const decisionMaker = await scopedPrisma.user.findFirst({ where: { id: decidedBy } });
    if (!decisionMaker) return { formError: "المستخدم غير موجود." };
    await withScopedTransaction(async (tx) => {
      const entry = await tx.decisionLogEntry.create({
        data: { orgId: user.orgId, title, decisionDate: new Date(decisionDate), decidedBy, context: context || undefined, outcome: outcome || undefined },
      });
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "decisionLogEntry.created",
        entityType: "DecisionLogEntry",
        entityId: entry.id,
        afterValue: { title },
      });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "createDecisionLogEntry", error: e });
    return { formError: businessRuleMessage(e, "حصل خطأ أثناء تسجيل القرار — حاول تاني.") };
  }

  revalidatePath("/governance/decisions");
  return {};
}

const DecisionEditSchema = z.object({
  title: z.string().trim().min(1, "العنوان مطلوب"),
  context: z.string().trim().optional().or(z.literal("")),
  outcome: z.string().trim().optional().or(z.literal("")),
});

export type DecisionEditFormState = { errors?: Record<string, string[]>; formError?: string; success?: boolean };

/** تعديل عام — العنوان/السياق/النتيجة بس. عمدًا مش `decisionDate`/`decidedBy`: دول سجل تاريخي
 * لمين اتّخذ القرار وإمتى — تغييرهم بعد التسجيل معناه تزوير سجل قرار، مش تصحيح خطأ كتابي. */
export async function updateDecisionLogEntryAction(
  entryId: string,
  _prevState: DecisionEditFormState,
  formData: FormData
): Promise<DecisionEditFormState> {
  const parsed = DecisionEditSchema.safeParse({
    title: formData.get("title"),
    context: formData.get("context") || undefined,
    outcome: formData.get("outcome") || undefined,
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const user = await requireCurrentUser();
  const { title, context, outcome } = parsed.data;

  try {
    await requirePermission(user.roleId, "DecisionLogEntry", "Edit");
    await withScopedTransaction(async (tx) => {
      const before = await tx.decisionLogEntry.findUniqueOrThrow({ where: { id: entryId }, select: { title: true, context: true, outcome: true } });
      await tx.decisionLogEntry.update({ where: { id: entryId }, data: { title, context: context || null, outcome: outcome || null } });
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "decisionLogEntry.updated",
        entityType: "DecisionLogEntry",
        entityId: entryId,
        beforeValue: before,
        afterValue: { title, context: context || null, outcome: outcome || null },
      });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "updateDecisionLogEntryAction", error: e });
    return { formError: businessRuleMessage(e, "حصل خطأ أثناء تعديل القرار — حاول تاني.") };
  }

  revalidatePath("/governance/decisions");
  return { success: true };
}

// ==================== RiskRegisterItem ====================

const RiskSchema = z.object({
  title: z.string().trim().min(1, "العنوان مطلوب"),
  category: z.string().trim().min(1, "الفئة مطلوبة"),
  probability: z.coerce.number().int().min(0, "من 0 لـ100").max(100, "من 0 لـ100"),
  financialImpact: z.coerce.number().min(0, "الأثر المالي مطلوب"),
  currency: currencySchema,
  ownerId: z.string().uuid("اختر المسؤول"),
  mitigation: z.string().trim().optional().or(z.literal("")),
});

/** `ok` بيتضبط عند النجاح عشان الواجهة تقدر تفرّق النجاح عن الحالة الابتدائية
 *  (الاتنين كانوا `{}`) — محتاجها النافذة عشان تقفل نفسها. */
export type RiskFormState = { errors?: Record<string, string[]>; formError?: string; ok?: boolean };

/** ownerId مش بالضرورة المستخدم الحالي — مسؤول الخطر ممكن يكون محلل تاني مش اللي بيسجّل الخطر
 * (اتكشف بمراجعة كود، 8 سبتمبر — نفس ملحوظة DecisionLogEntry.decidedBy). */
export async function createRiskRegisterItem(_prevState: RiskFormState, formData: FormData): Promise<RiskFormState> {
  const parsed = RiskSchema.safeParse({
    title: formData.get("title"),
    category: formData.get("category"),
    probability: formData.get("probability"),
    financialImpact: formData.get("financialImpact"),
    currency: formData.get("currency"),
    ownerId: formData.get("ownerId"),
    mitigation: formData.get("mitigation") || undefined,
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const user = await requireCurrentUser();
  try {
    await requirePermission(user.roleId, "RiskRegisterItem", "Create");
    const scopedPrisma = await getScopedPrisma();
    const owner = await scopedPrisma.user.findFirst({ where: { id: parsed.data.ownerId } });
    if (!owner) return { formError: "المستخدم غير موجود." };
    await withScopedTransaction(async (tx) => {
      const item = await tx.riskRegisterItem.create({
        data: { orgId: user.orgId, ...parsed.data, mitigation: parsed.data.mitigation || undefined },
      });
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "riskRegisterItem.created",
        entityType: "RiskRegisterItem",
        entityId: item.id,
        afterValue: { title: parsed.data.title },
      });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "createRiskRegisterItem", error: e });
    return { formError: businessRuleMessage(e, "حصل خطأ أثناء تسجيل الخطر — حاول تاني.") };
  }

  revalidatePath("/governance/risks");
  return { ok: true };
}

export async function updateRiskStatusAction(riskId: string, status: "Open" | "Mitigated" | "Closed") {
  const user = await requireCurrentUser();
  await requirePermission(user.roleId, "RiskRegisterItem", "Edit");

  try {
    await withScopedTransaction(async (tx) => {
      const risk = await tx.riskRegisterItem.findUniqueOrThrow({ where: { id: riskId } });
      if (risk.status !== status) {
        await assertWorkflowTransitionAllowed(tx, user.orgId, "RiskRegisterItem", riskId, risk.status, status);
      }

      await tx.riskRegisterItem.update({ where: { id: riskId }, data: { status } });
      await logAudit(tx, { orgId: user.orgId, userId: user.id, action: "riskRegisterItem.statusChanged", entityType: "RiskRegisterItem", entityId: riskId, beforeValue: { status: risk.status }, afterValue: { status } });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "updateRiskStatusAction", error: e });
    throw new Error(businessRuleMessage(e, "حصل خطأ أثناء تعديل حالة الخطر."));
  }

  revalidatePath("/governance/risks");
}

// ==================== KPI ====================

const KpiSchema = z.object({
  name: z.string().trim().min(1, "الاسم مطلوب"),
  category: z.string().trim().min(1, "الفئة مطلوبة"),
  ownerId: z.string().uuid("اختر المسؤول"),
  targetValue: z.coerce.number().min(0, "القيمة المستهدفة مطلوبة"),
  actualValue: z.coerce.number().optional(),
  periodId: z.string().uuid("اختر فترة محاسبية"),
});

export type KpiFormState = { errors?: Record<string, string[]>; formError?: string };

/** actualValue إدخال يدوي عمدًا — مفيش محرك BI عام يحسبه تلقائيًا لكل نوع KPI ممكن. ownerId مش
 * بالضرورة المستخدم الحالي (اتكشف بمراجعة كود، 8 سبتمبر — نفس ملحوظة RiskRegisterItem.ownerId). */
export async function createKPI(_prevState: KpiFormState, formData: FormData): Promise<KpiFormState> {
  const parsed = KpiSchema.safeParse({
    name: formData.get("name"),
    category: formData.get("category"),
    ownerId: formData.get("ownerId"),
    targetValue: formData.get("targetValue"),
    actualValue: formData.get("actualValue") || undefined,
    periodId: formData.get("periodId"),
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const user = await requireCurrentUser();
  try {
    await requirePermission(user.roleId, "KPI", "Create");
    // ownerId/periodId إلزاميين وبيتعرضوا بلا `?.` في `/governance/kpis` (`k.owner.fullName`،
    // `k.period.periodName`) — لازم يتحققوا قبل الإنشاء (اتكشف في مراجعة وحدة 9، 6 سبتمبر).
    const scopedPrisma = await getScopedPrisma();
    const owner = await scopedPrisma.user.findFirst({ where: { id: parsed.data.ownerId } });
    if (!owner) return { formError: "المستخدم غير موجود." };
    const period = await scopedPrisma.accountingPeriod.findFirst({ where: { id: parsed.data.periodId } });
    if (!period) return { formError: "الفترة المحاسبية غير موجودة." };
    await withScopedTransaction(async (tx) => {
      const kpi = await tx.kPI.create({ data: { orgId: user.orgId, ...parsed.data } });
      await logAudit(tx, { orgId: user.orgId, userId: user.id, action: "kpi.created", entityType: "KPI", entityId: kpi.id, afterValue: { name: parsed.data.name } });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "createKPI", error: e });
    return { formError: businessRuleMessage(e, "حصل خطأ أثناء تسجيل المؤشر — حاول تاني.") };
  }

  revalidatePath("/governance/kpis");
  return {};
}

const KpiEditSchema = z.object({
  name: z.string().trim().min(1, "الاسم مطلوب"),
  category: z.string().trim().min(1, "الفئة مطلوبة"),
  targetValue: z.coerce.number().min(0, "القيمة المستهدفة مطلوبة"),
  actualValue: z.coerce.number().optional(),
});

export type KpiEditFormState = { errors?: Record<string, string[]>; formError?: string; success?: boolean };

/** تعديل عام — الاسم/الفئة/المستهدف/الفعلي. `actualValue` إدخال يدوي عمدًا (نفس ملحوظة الإنشاء)
 * فتعديله هنا طبيعي، مش استثناء. عمدًا مش `ownerId`/`periodId`: هوية "مين مسؤول عن مؤشر إيه في
 * فترة إيه" — تغييرهم بعد التسجيل يخلط تتبّع الأداء عبر الفترات، مش تصحيح خطأ كتابي. */
export async function updateKpiAction(kpiId: string, _prevState: KpiEditFormState, formData: FormData): Promise<KpiEditFormState> {
  const parsed = KpiEditSchema.safeParse({
    name: formData.get("name"),
    category: formData.get("category"),
    targetValue: formData.get("targetValue"),
    actualValue: formData.get("actualValue") || undefined,
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const user = await requireCurrentUser();
  const { name, category, targetValue, actualValue } = parsed.data;

  try {
    await requirePermission(user.roleId, "KPI", "Edit");
    await withScopedTransaction(async (tx) => {
      const before = await tx.kPI.findUniqueOrThrow({ where: { id: kpiId }, select: { name: true, category: true, targetValue: true, actualValue: true } });
      await tx.kPI.update({ where: { id: kpiId }, data: { name, category, targetValue, actualValue: actualValue ?? null } });
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "kpi.updated",
        entityType: "KPI",
        entityId: kpiId,
        beforeValue: { name: before.name, category: before.category, targetValue: before.targetValue.toString(), actualValue: before.actualValue?.toString() ?? null },
        afterValue: { name, category, targetValue, actualValue: actualValue ?? null },
      });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "updateKpiAction", error: e });
    return { formError: businessRuleMessage(e, "حصل خطأ أثناء تعديل المؤشر — حاول تاني.") };
  }

  revalidatePath("/governance/kpis");
  return { success: true };
}

// ==================== Notification ====================

export async function markNotificationReadAction(notificationId: string) {
  const user = await requireCurrentUser();
  await requirePermission(user.roleId, "Notification", "Edit");

  try {
    await withScopedTransaction(async (tx) => {
      // ⚠️ فلترة صريحة بـuserId — الإشعار شخصي، مش أي صف يقدر أي مستخدم يعلّمه مقروء لمجرد
      // إنه شايفه (Notification مالهاش scope حقيقي غير Own، والفحص هنا هو الـOwn الفعلي).
      const notification = await tx.notification.findUniqueOrThrow({ where: { id: notificationId } });
      if (notification.userId !== user.id) throw new Error("الإشعار ده مش بتاعك.");
      await tx.notification.update({ where: { id: notificationId }, data: { readAt: new Date() } });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "markNotificationReadAction", error: e });
    throw new Error(businessRuleMessage(e, "حصل خطأ أثناء تعليم الإشعار."));
  }

  revalidatePath("/notifications");
}

// ==================== MasterDataChangeRequest ====================

const ChangeRequestSchema = z.object({
  entityType: z.string().trim().min(1, "نوع الكيان مطلوب"),
  entityId: z.string().trim().min(1, "معرّف الكيان مطلوب"),
  proposedChanges: z.string().trim().min(1, "التغييرات المقترحة مطلوبة"),
});

export type ChangeRequestFormState = { errors?: Record<string, string[]>; formError?: string };

/** فورم عام لطلب تعديل كيان موجود بالفعل (entityId حقيقي) — لسه تسجيل بس، الاعتماد هنا
 * مبيطبّقش التغييرات على الصف تلقائيًا (محتاج قرار نطاق منفصل، مسجَّل في BACKLOG.md).
 * ⚠️ ده غير طلبات "إنشاء كيان جديد" (`requestEntityCreation` في src/lib/masterDataChangeRequest.ts،
 * مستدعاة من createCompany/createSupplier/createBankAccount) — دي بقت بوابة فعلية حقيقية،
 * الاعتماد بيولّد الصف فعليًا (راجع createEntityFromChangeRequest تحت). */
export async function createMasterDataChangeRequest(_prevState: ChangeRequestFormState, formData: FormData): Promise<ChangeRequestFormState> {
  const parsed = ChangeRequestSchema.safeParse({
    entityType: formData.get("entityType"),
    entityId: formData.get("entityId"),
    proposedChanges: formData.get("proposedChanges"),
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  let proposedChangesJson: object;
  try {
    proposedChangesJson = JSON.parse(parsed.data.proposedChanges);
  } catch {
    return { errors: { proposedChanges: ["التغييرات المقترحة لازم تكون JSON صالح — مثال: {\"creditLimit\": 50000}"] } };
  }

  const user = await requireCurrentUser();
  try {
    await requirePermission(user.roleId, "MasterDataChangeRequest", "Create");
    await withScopedTransaction(async (tx) => {
      const request = await tx.masterDataChangeRequest.create({
        data: {
          orgId: user.orgId,
          entityType: parsed.data.entityType,
          entityId: parsed.data.entityId,
          proposedChanges: proposedChangesJson,
          requestedBy: user.id,
        },
      });
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "masterDataChangeRequest.created",
        entityType: "MasterDataChangeRequest",
        entityId: request.id,
        afterValue: { entityType: parsed.data.entityType, entityId: parsed.data.entityId },
      });
      await notifyChangeRequestApprovers(tx, {
        orgId: user.orgId,
        requesterId: user.id,
        requestId: request.id,
        entityType: parsed.data.entityType,
      });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "createMasterDataChangeRequest", error: e });
    return { formError: businessRuleMessage(e, "حصل خطأ أثناء تسجيل الطلب — حاول تاني.") };
  }

  revalidatePath("/governance/change-requests");
  return {};
}

export async function decideMasterDataChangeRequestAction(requestId: string, status: "Approved" | "Rejected") {
  const user = await requireCurrentUser();
  await requirePermission(user.roleId, "MasterDataChangeRequest", "Edit");

  try {
    await withScopedTransaction(async (tx) => {
      const request = await tx.masterDataChangeRequest.findUniqueOrThrow({ where: { id: requestId } });
      if (request.status !== "Pending") throw new Error("الطلب ده اتقرر فيه بالفعل.");

      // اعتماد طلب "إنشاء جديد" (entityId === NEW) بيولّد الكيان فعليًا هنا — لو ده طلب تعديل
      // كيان موجود (entityId حقيقي)، مفيش تنفيذ آلي لسه (خارج نطاق هذا البند، راجع BACKLOG.md).
      //
      // ⚠️ دفاع في العمق ضروري هنا بالذات: MasterDataChangeRequest.Edit لوحدها ماينفعش تبقى
      // كافية لاعتماد إنشاء كيان — المعتمِد لازم يكون أصلًا عنده صلاحية {entityType}.Create
      // نفسها. دلوقتي Admin/CompanyOwner بس عندهم Edit وعندهم كل صلاحيات الإنشاء أصلًا (بلا
      // أثر فعلي)، لكن لو دور تاني اتضاف لـMasterDataChangeRequest.Edit مستقبلًا بلا Create
      // لنوع الكيان، كان هيقدر "يمنح نفسه" صلاحية إنشاء ماكانتلوش أصلًا — تصعيد صلاحيات صريح.
      const isCreationRequest = status === "Approved" && request.entityId === NEW_ENTITY_SENTINEL;
      if (isCreationRequest && !(await getPermissionScope(user.roleId, request.entityType, "Create"))) {
        throw new Error(`معندكش صلاحية إنشاء ${entityTypeLabel[request.entityType] ?? request.entityType} — مينفعش تعتمد طلب إنشاء من غيرها.`);
      }
      const createdEntityId = isCreationRequest
        ? await createEntityFromChangeRequest(tx, user.orgId, request.requestedBy, user.id, request.entityType, request.proposedChanges)
        : null;

      await tx.masterDataChangeRequest.update({
        where: { id: requestId },
        data: { status, approvedBy: user.id, ...(createdEntityId ? { entityId: createdEntityId } : {}) },
      });
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "masterDataChangeRequest.decided",
        entityType: "MasterDataChangeRequest",
        entityId: requestId,
        afterValue: { status, createdEntityId },
      });
      await notifyUser(tx, {
        orgId: user.orgId,
        userId: request.requestedBy,
        notificationType: "changeRequest.decided",
        title: status === "Approved" ? "اتوافق على طلب الاعتماد بتاعك" : "اتّرفض طلب الاعتماد بتاعك",
        relatedEntityType: "MasterDataChangeRequest",
        relatedEntityId: requestId,
      });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "decideMasterDataChangeRequestAction", error: e });
    throw new Error(businessRuleMessage(e, "حصل خطأ أثناء تسجيل القرار."));
  }

  revalidatePath("/governance/change-requests");
  revalidatePath("/companies");
  revalidatePath("/suppliers");
  revalidatePath("/accounting/bank-accounts");
  revalidatePath("/products");
  revalidatePath("/sourcing");
}

// ==================== FieldPermission (وحدة 9 — 7 سبتمبر) ====================

const FIELD_ACCESS_LEVELS = ["Hidden", "ReadOnly", "ReadWrite"] as const;

const FieldPermissionSchema = z.object({
  roleId: z.string().uuid("اختر دور"),
  entityType: z.string().trim().min(1, "اسم الكيان مطلوب"),
  fieldName: z.string().trim().min(1, "اسم الحقل مطلوب"),
  accessLevel: z.enum(FIELD_ACCESS_LEVELS, "اختار مستوى صلاحية صحيح"),
});

export type FieldPermissionFormState = { errors?: Record<string, string[]>; formError?: string };

export async function createFieldPermissionAction(_prevState: FieldPermissionFormState, formData: FormData): Promise<FieldPermissionFormState> {
  const parsed = FieldPermissionSchema.safeParse({
    roleId: formData.get("roleId"),
    entityType: formData.get("entityType"),
    fieldName: formData.get("fieldName"),
    accessLevel: formData.get("accessLevel"),
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const user = await requireCurrentUser();
  try {
    await requirePermission(user.roleId, "FieldPermission", "Create");
    // roleId جاي من الفورم — لازم يتأكد إنه فعلًا بتاع نفس المنظمة قبل الإنشاء (نفس فئة فحوصات
    // FK اللي اتصلحت في كل الوحدات التانية طول الجلسة).
    const scopedPrisma = await getScopedPrisma();
    const role = await scopedPrisma.role.findFirst({ where: { id: parsed.data.roleId } });
    if (!role) return { formError: "الدور غير موجود." };
    await withScopedTransaction(async (tx) => {
      const fieldPermission = await tx.fieldPermission.upsert({
        where: { roleId_entityType_fieldName: { roleId: parsed.data.roleId, entityType: parsed.data.entityType, fieldName: parsed.data.fieldName } },
        create: parsed.data,
        update: { accessLevel: parsed.data.accessLevel },
      });
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "fieldPermission.created",
        entityType: "FieldPermission",
        entityId: fieldPermission.id,
        afterValue: parsed.data,
      });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "createFieldPermissionAction", error: e });
    return { formError: businessRuleMessage(e, "حصل خطأ أثناء إضافة صلاحية الحقل — حاول تاني.") };
  }

  revalidatePath("/governance/field-permissions");
  return {};
}

export async function deleteFieldPermissionAction(fieldPermissionId: string) {
  const user = await requireCurrentUser();
  try {
    await requirePermission(user.roleId, "FieldPermission", "Delete");
    await withScopedTransaction(async (tx) => {
      await tx.fieldPermission.delete({ where: { id: fieldPermissionId } });
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "fieldPermission.deleted",
        entityType: "FieldPermission",
        entityId: fieldPermissionId,
      });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "deleteFieldPermissionAction", error: e });
    throw new Error(businessRuleMessage(e, "حصل خطأ أثناء حذف صلاحية الحقل."));
  }

  revalidatePath("/governance/field-permissions");
}

// ==================== WorkflowDefinition (وحدة 9 — 7 سبتمبر) ====================

const WorkflowDefinitionSchema = z.object({
  entityType: z.string().trim().min(1, "اسم الكيان مطلوب"),
  fromStage: z.string().trim().min(1, "المرحلة الحالية مطلوبة"),
  toStage: z.string().trim().min(1, "المرحلة المستهدفة مطلوبة"),
  requiredApprovalPolicyId: z.string().uuid().optional().or(z.literal("")),
});

export type WorkflowDefinitionFormState = { errors?: Record<string, string[]>; formError?: string };

/** بيضيف انتقال مسموح جديد لكيان — لو الزوج (entityType, fromStage, toStage) مش موجود هنا،
 * assertWorkflowTransitionAllowed (src/lib/workflow.ts) بيرفضه. requiredApprovalPolicyId
 * اختياري — لو موجود، الانتقال محتاج Approval معتمَد بـsubjectType `${entityType}.stageTransition`
 * قبل ما ينفَّذ. */
export async function createWorkflowDefinitionAction(_prevState: WorkflowDefinitionFormState, formData: FormData): Promise<WorkflowDefinitionFormState> {
  const rawPolicyId = formData.get("requiredApprovalPolicyId");
  const parsed = WorkflowDefinitionSchema.safeParse({
    entityType: formData.get("entityType"),
    fromStage: formData.get("fromStage"),
    toStage: formData.get("toStage"),
    // "__none__" = sentinel القيمة "بلا سياسة" من WorkflowDefinitionForm (Base UI Select مايقبلش
    // value فاضية) — نفس نمط assignUserTeam بالحرف.
    requiredApprovalPolicyId: rawPolicyId === "__none__" ? undefined : rawPolicyId || undefined,
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const user = await requireCurrentUser();
  const { requiredApprovalPolicyId, ...rest } = parsed.data;
  try {
    await requirePermission(user.roleId, "WorkflowDefinition", "Create");
    const scopedPrisma = await getScopedPrisma();
    if (requiredApprovalPolicyId) {
      const policy = await scopedPrisma.approvalPolicy.findFirst({ where: { id: requiredApprovalPolicyId } });
      if (!policy) return { formError: "سياسة الموافقة غير موجودة." };
    }
    await withScopedTransaction(async (tx) => {
      const definition = await tx.workflowDefinition.upsert({
        where: { orgId_entityType_fromStage_toStage: { orgId: user.orgId, ...rest } },
        create: { orgId: user.orgId, requiredApprovalPolicyId: requiredApprovalPolicyId || undefined, ...rest },
        update: { requiredApprovalPolicyId: requiredApprovalPolicyId || null },
      });
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "workflowDefinition.created",
        entityType: "WorkflowDefinition",
        entityId: definition.id,
        afterValue: { ...rest, requiredApprovalPolicyId: requiredApprovalPolicyId || null },
      });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "createWorkflowDefinitionAction", error: e });
    return { formError: businessRuleMessage(e, "حصل خطأ أثناء إضافة الانتقال — حاول تاني.") };
  }

  revalidatePath("/governance/workflow-definitions");
  return {};
}

export async function deleteWorkflowDefinitionAction(workflowDefinitionId: string) {
  const user = await requireCurrentUser();
  try {
    await requirePermission(user.roleId, "WorkflowDefinition", "Delete");
    await withScopedTransaction(async (tx) => {
      await tx.workflowDefinition.delete({ where: { id: workflowDefinitionId } });
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "workflowDefinition.deleted",
        entityType: "WorkflowDefinition",
        entityId: workflowDefinitionId,
      });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "deleteWorkflowDefinitionAction", error: e });
    throw new Error(businessRuleMessage(e, "حصل خطأ أثناء حذف الانتقال."));
  }

  revalidatePath("/governance/workflow-definitions");
}
