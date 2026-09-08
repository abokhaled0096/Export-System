"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getScopedPrisma, withScopedTransaction } from "@/lib/scoped-prisma";
import { requireCurrentUser } from "@/lib/session";
import { requirePermission } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { logError, isNextControlFlowError, businessRuleMessage } from "@/lib/errorLog";
import { requireAal2 } from "@/lib/mfa";
import { encryptSecret, updateSecret } from "@/lib/vault";
import { DEFAULT_MILESTONES } from "@/lib/logisticsLabels";
import { assertWorkflowTransitionAllowed } from "@/lib/workflow";

const SHIPMENT_TYPES = ["Commercial", "Sample", "Trial", "Tender", "Consolidated"] as const;
const TRANSPORT_MODES = ["Sea", "Air", "Road", "Rail", "Multimodal", "Courier"] as const;
const LOAD_TYPES = ["FCL", "LCL"] as const;
const INCOTERMS = ["EXW", "FCA", "FAS", "FOB", "CFR", "CIF", "CPT", "CIP", "DAP", "DPU", "DDP"] as const;

const ShipmentSchema = z.object({
  shipmentType: z.enum(SHIPMENT_TYPES, "اختار نوع شحنة صحيح"),
  transportMode: z.enum(TRANSPORT_MODES, "اختار وسيلة نقل صحيحة"),
  loadType: z.enum(LOAD_TYPES, "اختار نوع تحميل صحيح").optional().or(z.literal("")),
  incoterm: z.enum(INCOTERMS, "اختار Incoterm صحيح"),
  originPort: z.string().trim().min(1, "ميناء المنشأ مطلوب"),
  destinationPort: z.string().trim().min(1, "ميناء الوصول مطلوب"),
  finalDestination: z.string().trim().optional().or(z.literal("")),
  cargoReadyDate: z.string().trim().optional().or(z.literal("")),
  etd: z.string().trim().optional().or(z.literal("")),
  eta: z.string().trim().optional().or(z.literal("")),
});

export type ShipmentFormState = { errors?: Record<string, string[]>; formError?: string };

/** بينشئ شحنة لصفقة (productId بيتشتق من الصفقة نفسها، نفس نمط createComplianceCase) — وبيقترح
 * تلقائيًا الـ10 معالم الثابتة (DEFAULT_MILESTONES). complianceCaseId اختياري (Shipment ممكن
 * يتعمل قبل ما ملف امتثال يتفتح). */
export async function createShipment(
  dealId: string,
  complianceCaseId: string | null,
  _prevState: ShipmentFormState,
  formData: FormData
): Promise<ShipmentFormState> {
  const parsed = ShipmentSchema.safeParse({
    shipmentType: formData.get("shipmentType"),
    transportMode: formData.get("transportMode"),
    loadType: formData.get("loadType") || undefined,
    incoterm: formData.get("incoterm"),
    originPort: formData.get("originPort"),
    destinationPort: formData.get("destinationPort"),
    finalDestination: formData.get("finalDestination") || undefined,
    cargoReadyDate: formData.get("cargoReadyDate") || undefined,
    etd: formData.get("etd") || undefined,
    eta: formData.get("eta") || undefined,
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const user = await requireCurrentUser();
  const { loadType, finalDestination, cargoReadyDate, etd, eta, ...rest } = parsed.data;
  let shipmentId: string;
  try {
    await requirePermission(user.roleId, "Shipment", "Create");
    const scopedPrisma = await getScopedPrisma();
    const deal = await scopedPrisma.deal.findUniqueOrThrow({ where: { id: dealId } });

    // complianceCaseId اختياري جاي من الباراميتر — لازم يتأكد إنه فعلًا بتاع نفس المنظمة قبل
    // الربط (اتكشف في إعادة مراجعة وحدة 6، 7 سبتمبر — نفس فئة فحوصات FK المُضافة في وحدة 5).
    if (complianceCaseId) {
      const kase = await scopedPrisma.complianceCase.findFirst({ where: { id: complianceCaseId } });
      if (!kase) return { formError: "ملف الامتثال غير موجود." };
    }

    shipmentId = await withScopedTransaction(async (tx) => {
      const shipment = await tx.shipment.create({
        data: {
          orgId: user.orgId,
          dealId,
          productId: deal.productId,
          complianceCaseId: complianceCaseId || undefined,
          loadType: loadType || undefined,
          finalDestination: finalDestination || undefined,
          cargoReadyDate: cargoReadyDate ? new Date(cargoReadyDate) : undefined,
          etd: etd ? new Date(etd) : undefined,
          eta: eta ? new Date(eta) : undefined,
          ...rest,
        },
      });
      await tx.milestone.createMany({
        data: DEFAULT_MILESTONES.map((milestoneName, i) => ({
          orgId: user.orgId,
          shipmentId: shipment.id,
          milestoneName,
          sequence: i + 1,
        })),
      });
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "shipment.created",
        entityType: "Shipment",
        entityId: shipment.id,
        afterValue: { dealId, complianceCaseId: complianceCaseId || null, ...rest },
      });
      return shipment.id;
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "createShipment", error: e });
    return { formError: "حصل خطأ أثناء إنشاء الشحنة — حاول تاني." };
  }

  if (complianceCaseId) revalidatePath(`/compliance/${complianceCaseId}`);
  revalidatePath("/logistics");
  redirect(`/logistics/${shipmentId}`);
}

const ACI_STATUSES = ["NotRequired", "Pending", "Submitted", "Approved", "Rejected"] as const;

const ShipmentAciSchema = z.object({
  acidNumber: z.string().trim().optional().or(z.literal("")),
  aciStatus: z.enum(ACI_STATUSES, "اختار حالة ACI صحيحة"),
  aciSubmittedAt: z.string().trim().optional().or(z.literal("")),
});

export type ShipmentAciFormState = { errors?: Record<string, string[]>; formError?: string };

/** بيحدّث بيانات تصدير ACI ويعيد حساب aciDeadlineMet (مش DB generated column — راجع تعليق
 * Shipment.aciDeadlineMet في schema.prisma): aciSubmittedAt <= etd - 48 ساعة. */
export async function updateShipmentAci(
  shipmentId: string,
  _prevState: ShipmentAciFormState,
  formData: FormData
): Promise<ShipmentAciFormState> {
  const parsed = ShipmentAciSchema.safeParse({
    acidNumber: formData.get("acidNumber") || undefined,
    aciStatus: formData.get("aciStatus"),
    aciSubmittedAt: formData.get("aciSubmittedAt") || undefined,
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const user = await requireCurrentUser();
  const { acidNumber, aciStatus, aciSubmittedAt } = parsed.data;
  try {
    await requirePermission(user.roleId, "Shipment", "Edit");
    await withScopedTransaction(async (tx) => {
      const shipment = await tx.shipment.findUniqueOrThrow({ where: { id: shipmentId } });
      const submittedAt = aciSubmittedAt ? new Date(aciSubmittedAt) : null;
      const aciDeadlineMet =
        aciStatus === "NotRequired"
          ? false
          : Boolean(submittedAt && shipment.etd && submittedAt.getTime() <= shipment.etd.getTime() - 48 * 60 * 60 * 1000);

      await tx.shipment.update({
        where: { id: shipmentId },
        data: { acidNumber: acidNumber || undefined, aciStatus, aciSubmittedAt: submittedAt, aciDeadlineMet },
      });
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "shipment.aciUpdated",
        entityType: "Shipment",
        entityId: shipmentId,
        afterValue: { acidNumber: acidNumber || null, aciStatus, aciSubmittedAt: submittedAt, aciDeadlineMet },
      });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "updateShipmentAci", error: e });
    return { formError: "حصل خطأ أثناء تحديث بيانات ACI — حاول تاني." };
  }

  revalidatePath(`/logistics/${shipmentId}`);
  return {};
}

const PARTY_ROLES = ["Buyer", "Consignee", "NotifyParty", "ImporterOfRecord", "CustomsBroker"] as const;
const ShipmentPartySchema = z.object({
  partyRole: z.enum(PARTY_ROLES, "اختار دور صحيح"),
  companyId: z.string().uuid("اختر شركة"),
});

export type ShipmentPartyFormState = { errors?: Record<string, string[]>; formError?: string };

export async function addShipmentParty(
  shipmentId: string,
  _prevState: ShipmentPartyFormState,
  formData: FormData
): Promise<ShipmentPartyFormState> {
  const parsed = ShipmentPartySchema.safeParse({
    partyRole: formData.get("partyRole"),
    companyId: formData.get("companyId"),
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const user = await requireCurrentUser();
  try {
    await requirePermission(user.roleId, "Shipment", "Edit");
    // companyId إلزامي وبيتعرض بلا `?.` في `/logistics/[id]` (`p.company.legalName`) — لازم
    // يتأكد إنه فعلًا بتاع نفس المنظمة قبل الإنشاء، وإلا كسر صفحة الشحنة بالكامل لأي حد في
    // المنظمة (اتكشف في إعادة مراجعة وحدة 6، 7 سبتمبر — نفس فئة باگ Competitor الأصلي).
    const scopedPrisma = await getScopedPrisma();
    const company = await scopedPrisma.company.findFirst({ where: { id: parsed.data.companyId, deletedAt: null } });
    if (!company) return { formError: "الشركة غير موجودة." };
    await withScopedTransaction(async (tx) => {
      const party = await tx.shipmentParty.create({
        data: { orgId: user.orgId, shipmentId, ...parsed.data },
      });
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "shipmentParty.created",
        entityType: "ShipmentParty",
        entityId: party.id,
        afterValue: { shipmentId, ...parsed.data },
      });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "addShipmentParty", error: e });
    return { formError: "حصل خطأ أثناء إضافة الطرف — حاول تاني." };
  }

  revalidatePath(`/logistics/${shipmentId}`);
  return {};
}

const BookingSchema = z.object({
  bookingNumber: z.string().trim().optional().or(z.literal("")),
  vessel: z.string().trim().optional().or(z.literal("")),
  voyage: z.string().trim().optional().or(z.literal("")),
  etd: z.string().trim().optional().or(z.literal("")),
  eta: z.string().trim().optional().or(z.literal("")),
  documentationCutoff: z.string().trim().optional().or(z.literal("")),
  vgmDeadline: z.string().trim().optional().or(z.literal("")),
  portClosingDate: z.string().trim().optional().or(z.literal("")),
  freeTimeDays: z.coerce.number().int().min(0, "لازم يكون 0 أو أكتر").optional(),
  providerId: z.string().uuid().optional().or(z.literal("")),
  freightQuoteId: z.string().uuid().optional().or(z.literal("")),
});

export type BookingFormState = { errors?: Record<string, string[]>; formError?: string };

export async function createBooking(
  shipmentId: string,
  _prevState: BookingFormState,
  formData: FormData
): Promise<BookingFormState> {
  const parsed = BookingSchema.safeParse({
    bookingNumber: formData.get("bookingNumber") || undefined,
    vessel: formData.get("vessel") || undefined,
    voyage: formData.get("voyage") || undefined,
    etd: formData.get("etd") || undefined,
    eta: formData.get("eta") || undefined,
    documentationCutoff: formData.get("documentationCutoff") || undefined,
    vgmDeadline: formData.get("vgmDeadline") || undefined,
    portClosingDate: formData.get("portClosingDate") || undefined,
    freeTimeDays: formData.get("freeTimeDays") || undefined,
    providerId: formData.get("providerId") || undefined,
    freightQuoteId: formData.get("freightQuoteId") || undefined,
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const user = await requireCurrentUser();
  const { bookingNumber, vessel, voyage, etd, eta, documentationCutoff, vgmDeadline, portClosingDate, providerId, freightQuoteId, ...rest } = parsed.data;
  try {
    await requirePermission(user.roleId, "Booking", "Create");
    // providerId/freightQuoteId اختياريين جايين من الفورم — لازم يتأكدوا إنهم بتوع نفس المنظمة
    // قبل الإنشاء (اتكشف في إعادة مراجعة وحدة 6، 7 سبتمبر). ⚠️ مش Promise.all — راجع BACKLOG.md (P2028).
    const scopedPrisma = await getScopedPrisma();
    if (providerId) {
      const provider = await scopedPrisma.serviceProvider.findFirst({ where: { id: providerId } });
      if (!provider) return { formError: "مزوّد الخدمة غير موجود." };
    }
    if (freightQuoteId) {
      const freightQuote = await scopedPrisma.freightQuote.findFirst({ where: { id: freightQuoteId } });
      if (!freightQuote) return { formError: "عرض سعر الشحن غير موجود." };
    }
    await withScopedTransaction(async (tx) => {
      const booking = await tx.booking.create({
        data: {
          orgId: user.orgId,
          shipmentId,
          status: "Draft",
          bookingNumber: bookingNumber || undefined,
          vessel: vessel || undefined,
          voyage: voyage || undefined,
          etd: etd ? new Date(etd) : undefined,
          eta: eta ? new Date(eta) : undefined,
          documentationCutoff: documentationCutoff ? new Date(documentationCutoff) : undefined,
          vgmDeadline: vgmDeadline ? new Date(vgmDeadline) : undefined,
          portClosingDate: portClosingDate ? new Date(portClosingDate) : undefined,
          providerId: providerId || undefined,
          freightQuoteId: freightQuoteId || undefined,
          ...rest,
        },
      });
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "booking.created",
        entityType: "Booking",
        entityId: booking.id,
        afterValue: { shipmentId, ...rest },
      });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "createBooking", error: e });
    return { formError: "حصل خطأ أثناء إضافة الحجز — حاول تاني." };
  }

  revalidatePath(`/logistics/${shipmentId}`);
  return {};
}

const CONTAINER_TYPES = ["GP20", "GP40", "HC40", "RF20", "RF40", "HCRF40", "OpenTop", "FlatRack", "Tank"] as const;
const ContainerSchema = z.object({
  containerNumber: z.string().trim().optional().or(z.literal("")),
  containerType: z.enum(CONTAINER_TYPES, "اختار نوع حاوية صحيح"),
  sealNumber: z.string().trim().optional().or(z.literal("")),
  maxPayload: z.coerce.number().min(0, "لازم يكون 0 أو أكتر").optional(),
  netWeight: z.coerce.number().min(0, "لازم يكون 0 أو أكتر").optional(),
  grossWeight: z.coerce.number().min(0, "لازم يكون 0 أو أكتر").optional(),
  usedVolume: z.coerce.number().min(0, "لازم يكون 0 أو أكتر").optional(),
  availableVolume: z.coerce.number().min(0, "لازم يكون 0 أو أكتر").optional(),
  setPointTempC: z.coerce.number().optional(),
});

export type ContainerFormState = { errors?: Record<string, string[]>; formError?: string };

export async function addContainer(
  shipmentId: string,
  _prevState: ContainerFormState,
  formData: FormData
): Promise<ContainerFormState> {
  const parsed = ContainerSchema.safeParse({
    containerNumber: formData.get("containerNumber") || undefined,
    containerType: formData.get("containerType"),
    sealNumber: formData.get("sealNumber") || undefined,
    maxPayload: formData.get("maxPayload") || undefined,
    netWeight: formData.get("netWeight") || undefined,
    grossWeight: formData.get("grossWeight") || undefined,
    usedVolume: formData.get("usedVolume") || undefined,
    availableVolume: formData.get("availableVolume") || undefined,
    setPointTempC: formData.get("setPointTempC") || undefined,
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const user = await requireCurrentUser();
  const { containerNumber, sealNumber, ...rest } = parsed.data;
  try {
    await requirePermission(user.roleId, "Container", "Create");
    await withScopedTransaction(async (tx) => {
      const container = await tx.container.create({
        data: {
          orgId: user.orgId,
          shipmentId,
          containerNumber: containerNumber || undefined,
          sealNumber: sealNumber || undefined,
          ...rest,
        },
      });
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "container.created",
        entityType: "Container",
        entityId: container.id,
        afterValue: { shipmentId, ...rest },
      });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "addContainer", error: e });
    return { formError: "حصل خطأ أثناء إضافة الحاوية — حاول تاني." };
  }

  revalidatePath(`/logistics/${shipmentId}`);
  return {};
}

const MILESTONE_STATUSES = ["NotStarted", "Planned", "InProgress", "Completed", "Delayed", "Missed", "Blocked", "NotApplicable"] as const;
const UpdateMilestoneSchema = z.object({
  status: z.enum(MILESTONE_STATUSES, "اختار حالة معلم صحيحة"),
  actualDate: z.string().trim().optional().or(z.literal("")),
  delayReason: z.string().trim().optional().or(z.literal("")),
});

export type UpdateMilestoneState = { formError?: string };

export async function updateMilestone(
  milestoneId: string,
  shipmentId: string,
  _prevState: UpdateMilestoneState,
  formData: FormData
): Promise<UpdateMilestoneState> {
  const parsed = UpdateMilestoneSchema.safeParse({
    status: formData.get("status"),
    actualDate: formData.get("actualDate") || undefined,
    delayReason: formData.get("delayReason") || undefined,
  });
  if (!parsed.success) return { formError: "بيانات غير صالحة." };

  const user = await requireCurrentUser();
  const { status, actualDate, delayReason } = parsed.data;
  try {
    await requirePermission(user.roleId, "Milestone", "Edit");
    await withScopedTransaction(async (tx) => {
      const before = await tx.milestone.findUniqueOrThrow({ where: { id: milestoneId } });
      // انتقال حقيقي بقى — بس الأزواج المسموح بيها في جدول WorkflowDefinition (وحدة 9، راجع
      // STATUS.md 7 سبتمبر). كانت بلا أي فحص خالص قبل كده (اتكشف في إعادة مراجعة وحدة 6، 7 سبتمبر).
      if (before.status !== status) {
        await assertWorkflowTransitionAllowed(tx, user.orgId, "Milestone", milestoneId, before.status, status);
      }
      await tx.milestone.update({
        where: { id: milestoneId },
        data: {
          status,
          actualDate: actualDate ? new Date(actualDate) : status === "Completed" ? new Date() : undefined,
          delayReason: delayReason || undefined,
          ownerId: user.id,
        },
      });
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "milestone.statusUpdated",
        entityType: "Milestone",
        entityId: milestoneId,
        beforeValue: { status: before.status },
        afterValue: { status },
      });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "updateMilestone", error: e });
    return { formError: businessRuleMessage(e, "حصل خطأ أثناء تحديث المعلم — حاول تاني.") };
  }

  revalidatePath(`/logistics/${shipmentId}`);
  return {};
}

// ==================== الشريحة الثانية — التتبع التشغيلي (30 أغسطس) ====================

const SHIPMENT_EVENT_SOURCES = ["Manual", "ShippingLineWebsite", "FreightForwarder", "Port", "CustomsBroker", "Customer", "ImportedCSV", "API"] as const;
const ShipmentEventSchema = z.object({
  eventType: z.string().trim().min(1, "نوع الحدث مطلوب"),
  occurredAt: z.string().trim().min(1, "تاريخ الحدث مطلوب"),
  location: z.string().trim().optional().or(z.literal("")),
  source: z.enum(SHIPMENT_EVENT_SOURCES, "اختار مصدر حدث صحيح"),
  reliability: z.coerce.number().int().min(0, "لازم يكون 0 أو أكتر").max(100, "لازم يكون 100 أو أقل").optional(),
});

export type ShipmentEventFormState = { errors?: Record<string, string[]>; formError?: string };

export async function addShipmentEvent(
  shipmentId: string,
  _prevState: ShipmentEventFormState,
  formData: FormData
): Promise<ShipmentEventFormState> {
  const parsed = ShipmentEventSchema.safeParse({
    eventType: formData.get("eventType"),
    occurredAt: formData.get("occurredAt"),
    location: formData.get("location") || undefined,
    source: formData.get("source"),
    reliability: formData.get("reliability") || undefined,
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const user = await requireCurrentUser();
  const { occurredAt, location, ...rest } = parsed.data;
  try {
    await requirePermission(user.roleId, "ShipmentEvent", "Create");
    await withScopedTransaction(async (tx) => {
      const event = await tx.shipmentEvent.create({
        data: {
          orgId: user.orgId,
          shipmentId,
          occurredAt: new Date(occurredAt),
          location: location || undefined,
          enteredBy: user.id,
          ...rest,
        },
      });
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "shipmentEvent.created",
        entityType: "ShipmentEvent",
        entityId: event.id,
        afterValue: { shipmentId, ...rest },
      });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "addShipmentEvent", error: e });
    return { formError: "حصل خطأ أثناء تسجيل الحدث — حاول تاني." };
  }

  revalidatePath(`/logistics/${shipmentId}`);
  return {};
}

const LOGISTICS_EXCEPTION_TYPES = [
  "BookingRejected", "ContainerShortage", "TruckDelay", "LoadingDelay", "CustomsHold", "DocumentationError", "VGMError", "SealMismatch",
  "Overweight", "GateInMissed", "VesselDelay", "VesselChange", "RollOver", "PortCongestion", "TransshipmentDelay", "CargoDamage",
  "TemperatureExcursion", "ReeferFailure", "Shortage", "Demurrage", "Detention", "Strike", "Weather", "PortClosure",
] as const;
const LOGISTICS_EXCEPTION_SEVERITIES = ["Informational", "Low", "Medium", "High", "Critical"] as const;
const LOGISTICS_EXCEPTION_STATUSES = ["Open", "InProgress", "Resolved", "Closed"] as const;

const LogisticsExceptionSchema = z.object({
  exceptionType: z.enum(LOGISTICS_EXCEPTION_TYPES, "اختار نوع استثناء صحيح"),
  severity: z.enum(LOGISTICS_EXCEPTION_SEVERITIES, "اختار درجة خطورة صحيحة"),
  detectedAt: z.string().trim().min(1, "تاريخ الاكتشاف مطلوب"),
  rootCause: z.string().trim().optional().or(z.literal("")),
  financialExposure: z.coerce.number().min(0, "لازم يكون 0 أو أكتر").optional(),
  scheduleImpactDays: z.coerce.number().int().min(0, "لازم يكون 0 أو أكتر").optional(),
  recoveryPlan: z.string().trim().optional().or(z.literal("")),
});

export type LogisticsExceptionFormState = { errors?: Record<string, string[]>; formError?: string };

export async function createLogisticsException(
  shipmentId: string,
  _prevState: LogisticsExceptionFormState,
  formData: FormData
): Promise<LogisticsExceptionFormState> {
  const parsed = LogisticsExceptionSchema.safeParse({
    exceptionType: formData.get("exceptionType"),
    severity: formData.get("severity"),
    detectedAt: formData.get("detectedAt"),
    rootCause: formData.get("rootCause") || undefined,
    financialExposure: formData.get("financialExposure") || undefined,
    scheduleImpactDays: formData.get("scheduleImpactDays") || undefined,
    recoveryPlan: formData.get("recoveryPlan") || undefined,
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const user = await requireCurrentUser();
  const { detectedAt, rootCause, recoveryPlan, ...rest } = parsed.data;
  try {
    await requirePermission(user.roleId, "LogisticsException", "Create");
    await withScopedTransaction(async (tx) => {
      const exception = await tx.logisticsException.create({
        data: {
          orgId: user.orgId,
          shipmentId,
          detectedAt: new Date(detectedAt),
          rootCause: rootCause || undefined,
          recoveryPlan: recoveryPlan || undefined,
          ...rest,
        },
      });
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "logisticsException.created",
        entityType: "LogisticsException",
        entityId: exception.id,
        afterValue: { shipmentId, ...rest },
      });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "createLogisticsException", error: e });
    return { formError: "حصل خطأ أثناء تسجيل الاستثناء اللوجستي — حاول تاني." };
  }

  revalidatePath(`/logistics/${shipmentId}`);
  return {};
}

const UpdateLogisticsExceptionStatusSchema = z.object({ status: z.enum(LOGISTICS_EXCEPTION_STATUSES, "اختار حالة استثناء صحيحة") });

export type UpdateLogisticsExceptionStatusState = { formError?: string };

export async function updateLogisticsExceptionStatus(
  exceptionId: string,
  shipmentId: string,
  _prevState: UpdateLogisticsExceptionStatusState,
  formData: FormData
): Promise<UpdateLogisticsExceptionStatusState> {
  const parsed = UpdateLogisticsExceptionStatusSchema.safeParse({ status: formData.get("status") });
  if (!parsed.success) return { formError: "حالة غير صالحة." };

  const user = await requireCurrentUser();
  try {
    await requirePermission(user.roleId, "LogisticsException", "Edit");
    await withScopedTransaction(async (tx) => {
      const before = await tx.logisticsException.findUniqueOrThrow({ where: { id: exceptionId } });
      // انتقال حقيقي بقى — بس الأزواج المسموح بيها في جدول WorkflowDefinition (وحدة 9، راجع
      // STATUS.md 7 سبتمبر). كانت بلا أي فحص خالص قبل كده (اتكشف في إعادة مراجعة وحدة 6، 7 سبتمبر).
      if (before.status !== parsed.data.status) {
        await assertWorkflowTransitionAllowed(tx, user.orgId, "LogisticsException", exceptionId, before.status, parsed.data.status);
      }
      await tx.logisticsException.update({ where: { id: exceptionId }, data: { status: parsed.data.status } });
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "logisticsException.statusUpdated",
        entityType: "LogisticsException",
        entityId: exceptionId,
        beforeValue: { status: before.status },
        afterValue: { status: parsed.data.status },
      });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "updateLogisticsExceptionStatus", error: e });
    return { formError: businessRuleMessage(e, "حصل خطأ أثناء تحديث حالة الاستثناء — حاول تاني.") };
  }

  revalidatePath(`/logistics/${shipmentId}`);
  return {};
}

const FREE_TIME_CHARGE_TYPES = ["Demurrage", "Detention"] as const;
const FREE_TIME_LOCATIONS = ["Origin", "Destination"] as const;
const FreeTimeRecordSchema = z.object({
  containerId: z.string().uuid().optional().or(z.literal("")),
  chargeType: z.enum(FREE_TIME_CHARGE_TYPES, "اختار نوع رسوم صحيح"),
  location: z.enum(FREE_TIME_LOCATIONS, "اختار موقع صحيح"),
  freeDays: z.coerce.number().int().min(0, "لازم يكون 0 أو أكتر").optional(),
  startDate: z.string().trim().optional().or(z.literal("")),
  endDate: z.string().trim().optional().or(z.literal("")),
  estimatedCost: z.coerce.number().min(0, "لازم يكون 0 أو أكتر").optional(),
  actualCost: z.coerce.number().min(0, "لازم يكون 0 أو أكتر").optional(),
  currency: z.string().trim().optional().or(z.literal("")),
  responsibleParty: z.string().trim().optional().or(z.literal("")),
});

export type FreeTimeRecordFormState = { errors?: Record<string, string[]>; formError?: string };

export async function createFreeTimeRecord(
  shipmentId: string,
  _prevState: FreeTimeRecordFormState,
  formData: FormData
): Promise<FreeTimeRecordFormState> {
  const parsed = FreeTimeRecordSchema.safeParse({
    containerId: formData.get("containerId") || undefined,
    chargeType: formData.get("chargeType"),
    location: formData.get("location"),
    freeDays: formData.get("freeDays") || undefined,
    startDate: formData.get("startDate") || undefined,
    endDate: formData.get("endDate") || undefined,
    estimatedCost: formData.get("estimatedCost") || undefined,
    actualCost: formData.get("actualCost") || undefined,
    currency: formData.get("currency") || undefined,
    responsibleParty: formData.get("responsibleParty") || undefined,
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const user = await requireCurrentUser();
  const { containerId, startDate, endDate, currency, responsibleParty, ...rest } = parsed.data;
  try {
    await requirePermission(user.roleId, "FreeTimeRecord", "Create");
    // containerId اختياري جاي من الفورم — لازم يتأكد إنه فعلًا بتاع نفس المنظمة قبل الإنشاء
    // (اتكشف في إعادة مراجعة وحدة 6، 7 سبتمبر).
    if (containerId) {
      const scopedPrisma = await getScopedPrisma();
      const container = await scopedPrisma.container.findFirst({ where: { id: containerId } });
      if (!container) return { formError: "الحاوية غير موجودة." };
    }
    await withScopedTransaction(async (tx) => {
      const record = await tx.freeTimeRecord.create({
        data: {
          orgId: user.orgId,
          shipmentId,
          containerId: containerId || undefined,
          startDate: startDate ? new Date(startDate) : undefined,
          endDate: endDate ? new Date(endDate) : undefined,
          currency: currency || undefined,
          responsibleParty: responsibleParty || undefined,
          ...rest,
        },
      });
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "freeTimeRecord.created",
        entityType: "FreeTimeRecord",
        entityId: record.id,
        afterValue: { shipmentId, containerId: containerId || null, ...rest },
      });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "createFreeTimeRecord", error: e });
    return { formError: "حصل خطأ أثناء تسجيل سجل أيام السماح — حاول تاني." };
  }

  revalidatePath(`/logistics/${shipmentId}`);
  return {};
}

const ActualLogisticsCostSchema = z.object({
  costType: z.string().trim().min(1, "نوع التكلفة مطلوب"),
  expectedAmount: z.coerce.number().min(0, "لازم يكون 0 أو أكتر").optional(),
  actualAmount: z.coerce.number().min(0, "لازم يكون 0 أو أكتر").optional(),
  currency: z.string().trim().optional().or(z.literal("")),
  invoiceReference: z.string().trim().optional().or(z.literal("")),
});

export type ActualLogisticsCostFormState = { errors?: Record<string, string[]>; formError?: string };

export async function createActualLogisticsCost(
  shipmentId: string,
  _prevState: ActualLogisticsCostFormState,
  formData: FormData
): Promise<ActualLogisticsCostFormState> {
  const parsed = ActualLogisticsCostSchema.safeParse({
    costType: formData.get("costType"),
    expectedAmount: formData.get("expectedAmount") || undefined,
    actualAmount: formData.get("actualAmount") || undefined,
    currency: formData.get("currency") || undefined,
    invoiceReference: formData.get("invoiceReference") || undefined,
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const user = await requireCurrentUser();
  const { currency, invoiceReference, ...rest } = parsed.data;
  try {
    await requirePermission(user.roleId, "ActualLogisticsCost", "Create");
    await withScopedTransaction(async (tx) => {
      const cost = await tx.actualLogisticsCost.create({
        data: {
          orgId: user.orgId,
          shipmentId,
          currency: currency || undefined,
          invoiceReference: invoiceReference || undefined,
          ...rest,
        },
      });
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "actualLogisticsCost.created",
        entityType: "ActualLogisticsCost",
        entityId: cost.id,
        afterValue: { shipmentId, ...rest },
      });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "createActualLogisticsCost", error: e });
    return { formError: "حصل خطأ أثناء تسجيل التكلفة الفعلية — حاول تاني." };
  }

  revalidatePath(`/logistics/${shipmentId}`);
  return {};
}

// ==================== الشريحة الثالثة — TemperatureLog/TransportTrip/Claim (30 أغسطس) ====================

const TemperatureLogSchema = z.object({
  containerId: z.string().uuid().optional().or(z.literal("")),
  recordedAt: z.string().trim().min(1, "تاريخ القراءة مطلوب"),
  temperatureC: z.coerce.number(),
  humidityPct: z.coerce.number().min(0, "لازم يكون 0 أو أكتر").max(100, "لازم يكون 100 أو أقل").optional(),
  source: z.string().trim().optional().or(z.literal("")),
  deviceId: z.string().trim().optional().or(z.literal("")),
  isExcursion: z.coerce.boolean().optional(),
});

export type TemperatureLogFormState = { errors?: Record<string, string[]>; formError?: string };

export async function addTemperatureLog(
  shipmentId: string,
  _prevState: TemperatureLogFormState,
  formData: FormData
): Promise<TemperatureLogFormState> {
  const parsed = TemperatureLogSchema.safeParse({
    containerId: formData.get("containerId") || undefined,
    recordedAt: formData.get("recordedAt"),
    temperatureC: formData.get("temperatureC"),
    humidityPct: formData.get("humidityPct") || undefined,
    source: formData.get("source") || undefined,
    deviceId: formData.get("deviceId") || undefined,
    isExcursion: formData.get("isExcursion") === "on",
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const user = await requireCurrentUser();
  const { containerId, recordedAt, source, deviceId, ...rest } = parsed.data;
  try {
    await requirePermission(user.roleId, "TemperatureLog", "Create");
    // containerId اختياري جاي من الفورم — لازم يتأكد إنه فعلًا بتاع نفس المنظمة قبل الإنشاء
    // (اتكشف في إعادة مراجعة وحدة 6، 7 سبتمبر).
    if (containerId) {
      const scopedPrisma = await getScopedPrisma();
      const container = await scopedPrisma.container.findFirst({ where: { id: containerId } });
      if (!container) return { formError: "الحاوية غير موجودة." };
    }
    await withScopedTransaction(async (tx) => {
      const log = await tx.temperatureLog.create({
        data: {
          orgId: user.orgId,
          shipmentId,
          containerId: containerId || undefined,
          recordedAt: new Date(recordedAt),
          source: source || undefined,
          deviceId: deviceId || undefined,
          ...rest,
        },
      });
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "temperatureLog.created",
        entityType: "TemperatureLog",
        entityId: log.id,
        afterValue: { shipmentId, containerId: containerId || null, ...rest },
      });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "addTemperatureLog", error: e });
    return { formError: "حصل خطأ أثناء تسجيل قراءة الحرارة — حاول تاني." };
  }

  revalidatePath(`/logistics/${shipmentId}`);
  return {};
}

const TransportTripSchema = z.object({
  carrier: z.string().trim().optional().or(z.literal("")),
  vehicleNumber: z.string().trim().optional().or(z.literal("")),
  driverName: z.string().trim().optional().or(z.literal("")),
  pickupLocation: z.string().trim().optional().or(z.literal("")),
  appointmentAt: z.string().trim().optional().or(z.literal("")),
  loadingStart: z.string().trim().optional().or(z.literal("")),
  loadingFinish: z.string().trim().optional().or(z.literal("")),
  gateInAt: z.string().trim().optional().or(z.literal("")),
  emptyReturnAt: z.string().trim().optional().or(z.literal("")),
  cost: z.coerce.number().min(0, "لازم يكون 0 أو أكتر").optional(),
  currency: z.string().trim().optional().or(z.literal("")),
});

export type TransportTripFormState = { errors?: Record<string, string[]>; formError?: string };

/** بلا حقل driverPhone — العمود موجود بالـschema بس مشفّر عموديًا (🔒) بلا واجهة إدخال في هذه
 * الشريحة، نفس نمط CompanyForm بلا حقول بنكية. */
export async function createTransportTrip(
  shipmentId: string,
  _prevState: TransportTripFormState,
  formData: FormData
): Promise<TransportTripFormState> {
  const parsed = TransportTripSchema.safeParse({
    carrier: formData.get("carrier") || undefined,
    vehicleNumber: formData.get("vehicleNumber") || undefined,
    driverName: formData.get("driverName") || undefined,
    pickupLocation: formData.get("pickupLocation") || undefined,
    appointmentAt: formData.get("appointmentAt") || undefined,
    loadingStart: formData.get("loadingStart") || undefined,
    loadingFinish: formData.get("loadingFinish") || undefined,
    gateInAt: formData.get("gateInAt") || undefined,
    emptyReturnAt: formData.get("emptyReturnAt") || undefined,
    cost: formData.get("cost") || undefined,
    currency: formData.get("currency") || undefined,
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const user = await requireCurrentUser();
  const { carrier, vehicleNumber, driverName, pickupLocation, appointmentAt, loadingStart, loadingFinish, gateInAt, emptyReturnAt, currency, ...rest } =
    parsed.data;
  try {
    await requirePermission(user.roleId, "TransportTrip", "Create");
    await withScopedTransaction(async (tx) => {
      const trip = await tx.transportTrip.create({
        data: {
          orgId: user.orgId,
          shipmentId,
          status: "Scheduled",
          carrier: carrier || undefined,
          vehicleNumber: vehicleNumber || undefined,
          driverName: driverName || undefined,
          pickupLocation: pickupLocation || undefined,
          appointmentAt: appointmentAt ? new Date(appointmentAt) : undefined,
          loadingStart: loadingStart ? new Date(loadingStart) : undefined,
          loadingFinish: loadingFinish ? new Date(loadingFinish) : undefined,
          gateInAt: gateInAt ? new Date(gateInAt) : undefined,
          emptyReturnAt: emptyReturnAt ? new Date(emptyReturnAt) : undefined,
          currency: currency || undefined,
          ...rest,
        },
      });
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "transportTrip.created",
        entityType: "TransportTrip",
        entityId: trip.id,
        afterValue: { shipmentId, carrier: carrier || null, vehicleNumber: vehicleNumber || null, ...rest },
      });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "createTransportTrip", error: e });
    return { formError: "حصل خطأ أثناء تسجيل رحلة النقل — حاول تاني." };
  }

  revalidatePath(`/logistics/${shipmentId}`);
  return {};
}

const TransportTripDriverPhoneSchema = z.object({
  driverPhone: z.string().trim().min(1, "رقم التليفون مطلوب"),
});

export type TransportTripDriverPhoneFormState = { errors?: Record<string, string[]>; formError?: string; mfaRequired?: boolean; success?: boolean };

/** أول واجهة إدخال حقيقية لـTransportTrip.driverPhoneSecretId (🔒 مشفّر عبر Vault) — نفس نمط
 * updateSupplierBankInfoAction بالحرف: MFA (aal2) إلزامي، القيمة بتتشفّر قبل ما توصل لأي DB،
 * والعمود بيسجّل secretId بس. حقل واحد بس هنا (مش تعديل جزئي متعدد الحقول زي المورّد). */
export async function updateTransportTripDriverPhoneAction(
  tripId: string,
  _prevState: TransportTripDriverPhoneFormState,
  formData: FormData
): Promise<TransportTripDriverPhoneFormState> {
  const parsed = TransportTripDriverPhoneSchema.safeParse({ driverPhone: formData.get("driverPhone") });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const user = await requireCurrentUser();
  try {
    await requirePermission(user.roleId, "TransportTrip", "Edit");
  } catch {
    return { formError: "معندكش صلاحية تعديل رحلات النقل." };
  }
  try {
    await requireAal2();
  } catch {
    return { formError: "تعديل بيانات بنكية/شخصية محتاج تحقق بخطوتين (MFA) الأول.", mfaRequired: true };
  }

  let shipmentId: string;
  try {
    const trip = await withScopedTransaction((tx) => tx.transportTrip.findUniqueOrThrow({ where: { id: tripId } }));
    shipmentId = trip.shipmentId;

    const secretId = trip.driverPhoneSecretId
      ? await updateSecret(trip.driverPhoneSecretId, parsed.data.driverPhone).then(() => trip.driverPhoneSecretId!)
      : await encryptSecret(parsed.data.driverPhone, `TransportTrip ${tripId} driverPhone`);

    await withScopedTransaction(async (tx) => {
      await tx.transportTrip.update({ where: { id: tripId }, data: { driverPhoneSecretId: secretId } });
      // ممنوع تسجيل الرقم الفعلي في الـAuditLog — تسجيل إن التعديل حصل بس.
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "transportTrip.driverPhoneUpdated",
        entityType: "TransportTrip",
        entityId: tripId,
      });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "updateTransportTripDriverPhoneAction", error: e });
    return { formError: businessRuleMessage(e, "حصل خطأ أثناء حفظ رقم السائق — حاول تاني.") };
  }

  revalidatePath(`/logistics/${shipmentId}`);
  return { success: true };
}

const CLAIM_TYPES = [
  "CargoDamage", "TemperatureDamage", "WetDamage", "Shortage", "Loss", "Delay", "ContainerDamage", "Overcharge", "InvoiceDispute", "DemurrageDispute", "ServiceFailure",
] as const;
const CLAIM_STATUSES = [
  "Draft", "EvidenceCollection", "Submitted", "UnderReview", "AdditionalInfoRequired", "Accepted", "PartiallyAccepted", "Rejected", "Settled", "Closed",
] as const;

const ClaimSchema = z.object({
  claimType: z.enum(CLAIM_TYPES, "اختار نوع مطالبة صحيح"),
  claimedAgainst: z.string().trim().optional().or(z.literal("")),
  incidentDate: z.string().trim().optional().or(z.literal("")),
  notificationDate: z.string().trim().optional().or(z.literal("")),
  claimDeadline: z.string().trim().optional().or(z.literal("")),
  claimedAmount: z.coerce.number().min(0, "لازم يكون 0 أو أكتر").optional(),
  currency: z.string().trim().optional().or(z.literal("")),
});

export type ClaimFormState = { errors?: Record<string, string[]>; formError?: string };

export async function createClaim(shipmentId: string, _prevState: ClaimFormState, formData: FormData): Promise<ClaimFormState> {
  const parsed = ClaimSchema.safeParse({
    claimType: formData.get("claimType"),
    claimedAgainst: formData.get("claimedAgainst") || undefined,
    incidentDate: formData.get("incidentDate") || undefined,
    notificationDate: formData.get("notificationDate") || undefined,
    claimDeadline: formData.get("claimDeadline") || undefined,
    claimedAmount: formData.get("claimedAmount") || undefined,
    currency: formData.get("currency") || undefined,
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const user = await requireCurrentUser();
  const { claimedAgainst, incidentDate, notificationDate, claimDeadline, currency, ...rest } = parsed.data;
  try {
    await requirePermission(user.roleId, "Claim", "Create");
    await withScopedTransaction(async (tx) => {
      const claim = await tx.claim.create({
        data: {
          orgId: user.orgId,
          shipmentId,
          claimedAgainst: claimedAgainst || undefined,
          incidentDate: incidentDate ? new Date(incidentDate) : undefined,
          notificationDate: notificationDate ? new Date(notificationDate) : undefined,
          claimDeadline: claimDeadline ? new Date(claimDeadline) : undefined,
          currency: currency || undefined,
          ...rest,
        },
      });
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "claim.created",
        entityType: "Claim",
        entityId: claim.id,
        afterValue: { shipmentId, claimedAgainst: claimedAgainst || null, ...rest },
      });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "createClaim", error: e });
    return { formError: "حصل خطأ أثناء تسجيل المطالبة — حاول تاني." };
  }

  revalidatePath(`/logistics/${shipmentId}`);
  return {};
}

const UpdateClaimStatusSchema = z.object({
  status: z.enum(CLAIM_STATUSES, "اختار حالة مطالبة صحيحة"),
  settlementAmount: z.coerce.number().min(0, "لازم يكون 0 أو أكتر").optional(),
});

export type UpdateClaimStatusState = { formError?: string };

export async function updateClaimStatus(
  claimId: string,
  shipmentId: string,
  _prevState: UpdateClaimStatusState,
  formData: FormData
): Promise<UpdateClaimStatusState> {
  const parsed = UpdateClaimStatusSchema.safeParse({
    status: formData.get("status"),
    settlementAmount: formData.get("settlementAmount") || undefined,
  });
  if (!parsed.success) return { formError: "بيانات غير صالحة." };

  const user = await requireCurrentUser();
  const { status, settlementAmount } = parsed.data;
  try {
    await requirePermission(user.roleId, "Claim", "Edit");
    await withScopedTransaction(async (tx) => {
      const before = await tx.claim.findUniqueOrThrow({ where: { id: claimId } });
      // انتقال حقيقي بقى — بس الأزواج المسموح بيها في جدول WorkflowDefinition (وحدة 9، راجع
      // STATUS.md 7 سبتمبر). كانت بلا أي فحص خالص قبل كده (اتكشف في إعادة مراجعة وحدة 6، 7 سبتمبر).
      if (before.status !== status) {
        await assertWorkflowTransitionAllowed(tx, user.orgId, "Claim", claimId, before.status, status);
      }
      await tx.claim.update({ where: { id: claimId }, data: { status, settlementAmount } });
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "claim.statusUpdated",
        entityType: "Claim",
        entityId: claimId,
        beforeValue: { status: before.status },
        afterValue: { status, settlementAmount },
      });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "updateClaimStatus", error: e });
    return { formError: businessRuleMessage(e, "حصل خطأ أثناء تحديث حالة المطالبة — حاول تاني.") };
  }

  revalidatePath(`/logistics/${shipmentId}`);
  return {};
}

const ShipmentLotSchema = z.object({
  lotId: z.string().uuid("اختر دفعة (Lot)"),
  quantity: z.coerce.number().min(0, "لازم يكون 0 أو أكتر").optional(),
  cartons: z.coerce.number().int().min(0, "لازم يكون 0 أو أكتر").optional(),
  netWeight: z.coerce.number().min(0, "لازم يكون 0 أو أكتر").optional(),
  grossWeight: z.coerce.number().min(0, "لازم يكون 0 أو أكتر").optional(),
});

export type ShipmentLotFormState = { errors?: Record<string, string[]>; formError?: string };

/** بيربط Lot موجود (وحدة 7) بشحنة — جدول وسيط N:N بيسمح بالشحن الجزئي وSplit Container
 * (docs/ERD.md §9). آخر كيان لوحدة 6 (17/17)، بلا Trigger — توثيق بيانات بس. */
export async function addShipmentLot(shipmentId: string, _prevState: ShipmentLotFormState, formData: FormData): Promise<ShipmentLotFormState> {
  const parsed = ShipmentLotSchema.safeParse({
    lotId: formData.get("lotId"),
    quantity: formData.get("quantity") || undefined,
    cartons: formData.get("cartons") || undefined,
    netWeight: formData.get("netWeight") || undefined,
    grossWeight: formData.get("grossWeight") || undefined,
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const user = await requireCurrentUser();
  try {
    await requirePermission(user.roleId, "ShipmentLot", "Create");
    // لازم نتأكد إن lotId فعلًا بتاع نفس المنظمة قبل الربط — الـFK بيتحقق بس من وجود الصف
    // (أي منظمة)، وRLS مش بيتفحّص وقت تنفيذ FK constraint. `sl.lot.lotCode` بيتعرض بلا `?.`
    // في `/logistics/[id]` (نفس فئة باگ Competitor/Opportunity)، فأي lotId عابر للمنظمة كان
    // هيكسر صفحة الشحنة بالكامل (اتكشف في مراجعة وحدة 6، 6 سبتمبر).
    const scopedPrisma = await getScopedPrisma();
    const lot = await scopedPrisma.lot.findFirst({ where: { id: parsed.data.lotId } });
    if (!lot) return { formError: "الدفعة (Lot) غير موجودة." };
    await withScopedTransaction(async (tx) => {
      const shipmentLot = await tx.shipmentLot.create({
        data: { orgId: user.orgId, shipmentId, ...parsed.data },
      });
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "shipmentLot.created",
        entityType: "ShipmentLot",
        entityId: shipmentLot.id,
        afterValue: { shipmentId, ...parsed.data },
      });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "addShipmentLot", error: e });
    return { formError: "حصل خطأ أثناء ربط الدفعة بالشحنة — حاول تاني." };
  }

  revalidatePath(`/logistics/${shipmentId}`);
  return {};
}
