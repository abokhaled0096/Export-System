"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getScopedPrisma, withScopedTransaction } from "@/lib/scoped-prisma";
import { requireCurrentUser } from "@/lib/session";
import { requirePermission, getPermissionScope, assertOwnScope } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { parseCsv } from "@/lib/csv";
import { logError, isNextControlFlowError } from "@/lib/errorLog";
import { deleteSecret } from "@/lib/vault";
import { requestEntityCreation } from "@/lib/masterDataChangeRequest";
import { CompanySchema } from "@/lib/companySchema";

export type CompanyFormState = {
  errors?: Partial<Record<keyof z.infer<typeof CompanySchema>, string[]>>;
  formError?: string;
};

export async function createCompany(
  _prevState: CompanyFormState,
  formData: FormData
): Promise<CompanyFormState> {
  const parsed = CompanySchema.safeParse({
    legalName: formData.get("legalName"),
    tradeName: formData.get("tradeName") || undefined,
    country: formData.get("country"),
    city: formData.get("city") || undefined,
    classification: formData.get("classification"),
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  // requireCurrentUser() بيعمل redirect() داخليًا لو الجلسة انتهت — لازم يكون برّه try/catch.
  const user = await requireCurrentUser();

  // مفيش صلاحية إنشاء مباشر؟ لو عنده صلاحية "طلب إضافة"، يتسجّل الطلب بدل الرفض المباشر —
  // بوابة اعتماد فعلية دلوقتي (راجع decideMasterDataChangeRequestAction)، مش تسجيل شكلي.
  if (!(await getPermissionScope(user.roleId, "Company", "Create"))) {
    if (!(await getPermissionScope(user.roleId, "MasterDataChangeRequest", "Create"))) {
      return { formError: "معندكش صلاحية إضافة شركة، ولا صلاحية طلب إضافة." };
    }
    try {
      // proposedChanges بيتخزّن بنفس شكل CompanySchema بالحرف (classification سطر واحد، مش
      // مصفوفة) — عشان إعادة الفحص وقت الاعتماد (createEntityFromChangeRequest) تنجح، الـ
      // wrapping لمصفوفة بيحصل هناك بس، نفس ما بيحصل هنا تحت في الإنشاء المباشر.
      await withScopedTransaction((tx) =>
        requestEntityCreation(tx, { orgId: user.orgId, userId: user.id, entityType: "Company", proposedChanges: parsed.data })
      );
    } catch (e) {
      if (isNextControlFlowError(e)) throw e;
      await logError({ orgId: user.orgId, userId: user.id, action: "createCompany.request", error: e });
      return { formError: "حصل خطأ أثناء تسجيل الطلب — حاول تاني." };
    }
    revalidatePath("/governance/change-requests");
    redirect("/governance/change-requests");
  }

  try {
    await requirePermission(user.roleId, "Company", "Create");
    const { classification, ...rest } = parsed.data;
    await withScopedTransaction(async (tx) => {
      // الشركة الجديدة بتبقى ملك المستخدم اللي أنشأها — أساس فحص Own scope على أي حاجة تابعة ليها لاحقًا.
      const company = await tx.company.create({
        data: { orgId: user.orgId, ...rest, classification: [classification], status: "Lead", ownerId: user.id },
      });
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "company.created",
        entityType: "Company",
        entityId: company.id,
        afterValue: { ...rest, classification: [classification] },
      });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "createCompany", error: e });
    return { formError: "حصل خطأ أثناء الحفظ — حاول تاني." };
  }

  revalidatePath("/companies");
  redirect("/companies");
}

const ContactSchema = z.object({
  companyId: z.string().uuid(),
  name: z.string().trim().min(2, "الاسم مطلوب"),
  title: z.string().trim().optional(),
  email: z.string().trim().email("إيميل غير صالح").optional().or(z.literal("")),
  decisionRole: z
    .enum([
      "DecisionMaker",
      "EconomicBuyer",
      "TechnicalEvaluator",
      "User",
      "Procurement",
      "Finance",
      "Quality",
      "Logistics",
      "Gatekeeper",
      "Influencer",
      "Champion",
      "Opponent",
      "Unknown",
    ])
    .optional(),
  consentGiven: z.coerce.boolean().optional(),
});

export type ContactFormState = {
  errors?: Partial<Record<keyof z.infer<typeof ContactSchema>, string[]>>;
  formError?: string;
};

export async function createContact(
  _prevState: ContactFormState,
  formData: FormData
): Promise<ContactFormState> {
  const parsed = ContactSchema.safeParse({
    companyId: formData.get("companyId"),
    name: formData.get("name"),
    title: formData.get("title") || undefined,
    email: formData.get("email") || undefined,
    decisionRole: formData.get("decisionRole") || undefined,
    consentGiven: formData.get("consentGiven") === "on",
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  // requireCurrentUser() بيعمل redirect() داخليًا لو الجلسة انتهت — لازم يكون برّه try/catch.
  const user = await requireCurrentUser();
  try {
    const scope = await requirePermission(user.roleId, "Contact", "Create");
    const scopedPrisma = await getScopedPrisma();
    const company = await scopedPrisma.company.findUniqueOrThrow({
      where: { id: parsed.data.companyId },
      select: { ownerId: true },
    });
    await assertOwnScope(scope, company.ownerId, user);

    const { email, consentGiven, ...rest } = parsed.data;
    // ⚠️ phone مش موجود في النموذج عن قصد — الحقل 🔒 مشفّر عبر Supabase Vault (src/lib/vault.ts)،
    // ومفيش فورم إدخال ليه لسه (يحتاج تصميم واجهة يشفّر عبر encryptSecret() قبل الحفظ).
    // consentAt بيتسجّل وقت إدخال الموظف للبيانات — ده توثيق داخلي إن الموافقة اتاخدت،
    // مش موافقة ذاتية من صاحب البيانات عبر النظام (راجع تعليق الـschema على Contact.consentGiven).
    await withScopedTransaction(async (tx) => {
      const contact = await tx.contact.create({
        data: {
          orgId: user.orgId,
          ...rest,
          email: email || undefined,
          consentGiven: consentGiven ?? false,
          consentAt: consentGiven ? new Date() : undefined,
        },
      });
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "contact.created",
        entityType: "Contact",
        entityId: contact.id,
        afterValue: { ...rest, email: email || undefined, consentGiven: consentGiven ?? false },
      });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "createContact", error: e });
    return { formError: "حصل خطأ أثناء الحفظ — حاول تاني." };
  }

  revalidatePath(`/companies/${parsed.data.companyId}`);
  redirect(`/companies/${parsed.data.companyId}`);
}

export type EraseContactState = { formError?: string; success?: boolean };

/**
 * PDPL — "حق المحو". بيمسح الحقول الشخصية (name/title/email/phoneSecretId/decisionRole) فعليًا ويسجّل
 * `erasedAt`، بدل حذف الصف كامل — عشان مايتكسرش تاريخ الفرص/الصفقات المرتبطة (referential
 * integrity)، وعشان الـAuditLog (Insert-only، ممنوع يتمسح) يفضل مرجع سليم لـentityId. الصف
 * بيفضل موجود كمرجع محايد بعد المحو، بس بلا أي بيانات شخصية.
 * مقصود يبقى Admin/CompanyOwner بس (`Contact.Delete`) — قرار محو بيانات لازم إشراف، مش أي مستخدم.
 */
export async function eraseContactData(
  contactId: string,
  _prevState: EraseContactState
): Promise<EraseContactState> {
  const user = await requireCurrentUser();

  try {
    await requirePermission(user.roleId, "Contact", "Delete");
  } catch {
    return { formError: "معندكش صلاحية محو بيانات جهات الاتصال — الصلاحية دي لـAdmin/CompanyOwner بس." };
  }

  const scopedPrisma = await getScopedPrisma();
  const contact = await scopedPrisma.contact.findFirst({ where: { id: contactId, orgId: user.orgId } });
  if (!contact) return { formError: "جهة الاتصال غير موجودة." };
  if (contact.erasedAt) return { formError: "بيانات جهة الاتصال دي اتمحت بالفعل." };

  try {
    // محو حقيقي في Vault نفسه لو فيه secretId — مسح الإشارة بس بيسيب الرقم المشفّر موجود
    // (لسه بلا واجهة إدخال دلوقتي، بس المحو لازم يبقى صحيح من أول يوم تتفعّل).
    if (contact.phoneSecretId) await deleteSecret(contact.phoneSecretId);

    await withScopedTransaction(async (tx) => {
      await tx.contact.update({
        where: { id: contactId },
        data: {
          name: "[بيانات محذوفة]",
          title: null,
          email: null,
          phoneSecretId: null,
          decisionRole: null,
          erasedAt: new Date(),
        },
      });
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "contact.erased",
        entityType: "Contact",
        entityId: contactId,
        beforeValue: { name: contact.name, email: contact.email },
      });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "eraseContactData", error: e });
    return { formError: "حصل خطأ أثناء محو بيانات جهة الاتصال — حاول تاني." };
  }

  revalidatePath(`/companies/${contact.companyId}`);
  return { success: true };
}

const MAX_IMPORT_ROWS = 500;

const CompanyImportSchema = z.object({
  legalName: z.string().trim().min(2, "الاسم القانوني مطلوب"),
  tradeName: z.string().trim().optional(),
  country: z.string().trim().min(1, "الدولة مطلوبة"),
  city: z.string().trim().optional(),
  // بيقبل أكتر من تصنيف مفصولين بـ"؛" (نفس فاصل التصدير) — الفورم اليدوي بيسمح بواحد بس،
  // لكن الموديل نفسه String[] فمفيش داعي نقيّد الاستيراد بنفس قيد الفورم.
  classification: z.string().trim().min(1, "التصنيف مطلوب"),
});

export type ImportCompaniesState = {
  formError?: string;
  summary?: { created: number; failed: number; errors: { row: number; message: string }[] };
};

/** استيراد جماعي من CSV — أعمدة الملف لازم تطابق تسميات تصدير `/companies/export` بالظبط. */
export async function importCompaniesCsv(
  _prevState: ImportCompaniesState,
  formData: FormData
): Promise<ImportCompaniesState> {
  const user = await requireCurrentUser();
  try {
    await requirePermission(user.roleId, "Company", "Create");
  } catch {
    return { formError: "معندكش صلاحية إضافة شركات." };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { formError: "لازم تختار ملف CSV." };
  }

  const text = await file.text();
  const { data, errors: parseErrors } = parseCsv(text);
  if (parseErrors.length > 0) {
    return { formError: `الملف فيه مشكلة تنسيق: ${parseErrors[0]}` };
  }
  if (data.length === 0) {
    return { formError: "الملف فاضي — لازم يكون فيه سطر عناوين وسطر بيانات على الأقل." };
  }
  if (data.length > MAX_IMPORT_ROWS) {
    return { formError: `الملف فيه ${data.length} صف — الحد الأقصى ${MAX_IMPORT_ROWS} صف لكل استيراد.` };
  }

  const rowErrors: { row: number; message: string }[] = [];
  let created = 0;

  for (let i = 0; i < data.length; i++) {
    const raw = data[i];
    const parsed = CompanyImportSchema.safeParse({
      legalName: raw["الاسم القانوني"],
      tradeName: raw["الاسم التجاري"] || undefined,
      country: raw["الدولة"],
      city: raw["المدينة"] || undefined,
      classification: raw["التصنيف"],
    });
    if (!parsed.success) {
      rowErrors.push({ row: i + 2, message: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" });
      continue;
    }

    const { classification, ...rest } = parsed.data;
    const classifications = classification.split(/[؛,]/).map((c) => c.trim()).filter(Boolean);

    try {
      await withScopedTransaction(async (tx) => {
        const company = await tx.company.create({
          data: { orgId: user.orgId, ...rest, classification: classifications, status: "Lead", ownerId: user.id },
        });
        await logAudit(tx, {
          orgId: user.orgId,
          userId: user.id,
          action: "company.created",
          entityType: "Company",
          entityId: company.id,
          afterValue: { ...rest, classification: classifications, source: "csv-import" },
        });
      });
      created++;
    } catch (e) {
      if (isNextControlFlowError(e)) throw e;
      await logError({ orgId: user.orgId, userId: user.id, action: "importCompaniesCsv", error: e });
      rowErrors.push({ row: i + 2, message: "فشل الحفظ في قاعدة البيانات" });
    }
  }

  revalidatePath("/companies");
  return { summary: { created, failed: rowErrors.length, errors: rowErrors.slice(0, 20) } };
}

const ArchiveCompanySchema = z.string().uuid();

export async function archiveCompany(companyId: string) {
  const parsed = ArchiveCompanySchema.safeParse(companyId);
  if (!parsed.success) throw new Error("معرّف شركة غير صالح.");

  const user = await requireCurrentUser();
  const scope = await requirePermission(user.roleId, "Company", "Edit");
  const scopedPrisma = await getScopedPrisma();
  const company = await scopedPrisma.company.findFirst({ where: { id: parsed.data, orgId: user.orgId } });
  if (!company) throw new Error("الشركة غير موجودة.");
  await assertOwnScope(scope, company.ownerId, user);

  try {
    await withScopedTransaction(async (tx) => {
      await tx.company.update({ where: { id: parsed.data }, data: { deletedAt: new Date() } });
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "company.archived",
        entityType: "Company",
        entityId: parsed.data,
      });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "archiveCompany", error: e });
    throw new Error("حصل خطأ أثناء الأرشفة — حاول تاني.");
  }

  revalidatePath("/companies");
  revalidatePath("/companies/archived");
}

const RestoreCompanySchema = z.string().uuid();

export async function restoreCompany(companyId: string) {
  const parsed = RestoreCompanySchema.safeParse(companyId);
  if (!parsed.success) throw new Error("معرّف شركة غير صالح.");

  const user = await requireCurrentUser();
  const scope = await requirePermission(user.roleId, "Company", "Edit");
  const scopedPrisma = await getScopedPrisma();
  const company = await scopedPrisma.company.findFirst({ where: { id: parsed.data, orgId: user.orgId } });
  if (!company) throw new Error("الشركة غير موجودة.");
  await assertOwnScope(scope, company.ownerId, user);

  try {
    await withScopedTransaction(async (tx) => {
      await tx.company.update({ where: { id: parsed.data }, data: { deletedAt: null } });
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "company.restored",
        entityType: "Company",
        entityId: parsed.data,
      });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "restoreCompany", error: e });
    throw new Error("حصل خطأ أثناء الاستعادة — حاول تاني.");
  }

  revalidatePath("/companies");
  revalidatePath("/companies/archived");
}

const RED_FLAG_SEVERITIES = ["Low", "Medium", "High", "Critical"] as const;

const RedFlagSchema = z.object({
  flagType: z.string().trim().min(1, "نوع العلم مطلوب"),
  severity: z.enum(RED_FLAG_SEVERITIES),
  description: z.string().trim().optional().or(z.literal("")),
  blocksDealing: z.coerce.boolean().optional(),
});

export type RedFlagFormState = { errors?: Record<string, string[]>; formError?: string };

/** raisedBy بيتحدَّد تلقائيًا بالمستخدم الحالي — نفس نمط CAPA.ownerId. */
export async function createRedFlag(companyId: string, _prevState: RedFlagFormState, formData: FormData): Promise<RedFlagFormState> {
  const parsed = RedFlagSchema.safeParse({
    flagType: formData.get("flagType"),
    severity: formData.get("severity"),
    description: formData.get("description") || undefined,
    blocksDealing: formData.get("blocksDealing") === "on",
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const user = await requireCurrentUser();
  const scope = await requirePermission(user.roleId, "RedFlag", "Create");
  const { description, ...rest } = parsed.data;

  try {
    const scopedPrisma = await getScopedPrisma();
    const company = await scopedPrisma.company.findUniqueOrThrow({ where: { id: companyId }, select: { ownerId: true } });
    await assertOwnScope(scope, company.ownerId, user);

    await withScopedTransaction(async (tx) => {
      const redFlag = await tx.redFlag.create({
        data: { orgId: user.orgId, companyId, raisedBy: user.id, description: description || undefined, ...rest },
      });
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "redFlag.created",
        entityType: "RedFlag",
        entityId: redFlag.id,
        afterValue: { companyId, ...rest },
      });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "createRedFlag", error: e });
    return { formError: "حصل خطأ أثناء إضافة العلم التحذيري — حاول تاني." };
  }

  revalidatePath(`/companies/${companyId}`);
  return {};
}

const CUSTOMER_SERVICE_CASE_TYPES = ["Complaint", "Claim", "QualityIssue", "Shortage", "Damage", "LateShipment", "WrongDocumentation"] as const;
const CUSTOMER_SERVICE_CASE_STATUSES = ["Open", "Investigating", "PendingCustomer", "Resolved", "Closed"] as const;

const CustomerServiceCaseSchema = z.object({
  caseType: z.enum(CUSTOMER_SERVICE_CASE_TYPES),
  slaDeadline: z.string().trim().optional().or(z.literal("")),
  rootCause: z.string().trim().optional().or(z.literal("")),
  capaId: z.string().uuid().optional().or(z.literal("")),
  compensationAmount: z.coerce.number().min(0).optional(),
  currency: z.string().trim().length(3).toUpperCase().optional().or(z.literal("")),
  status: z.enum(CUSTOMER_SERVICE_CASE_STATUSES),
});

export type CustomerServiceCaseFormState = { errors?: Record<string, string[]>; formError?: string };

/** ownerId بيتحدَّد تلقائيًا بالمستخدم الحالي — نفس نمط RedFlag.raisedBy. */
export async function createCustomerServiceCase(companyId: string, _prevState: CustomerServiceCaseFormState, formData: FormData): Promise<CustomerServiceCaseFormState> {
  const parsed = CustomerServiceCaseSchema.safeParse({
    caseType: formData.get("caseType"),
    slaDeadline: formData.get("slaDeadline") || undefined,
    rootCause: formData.get("rootCause") || undefined,
    capaId: formData.get("capaId") || undefined,
    compensationAmount: formData.get("compensationAmount") || undefined,
    currency: formData.get("currency") || undefined,
    status: formData.get("status"),
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const user = await requireCurrentUser();
  const scope = await requirePermission(user.roleId, "CustomerServiceCase", "Create");
  const { slaDeadline, rootCause, capaId, currency, ...rest } = parsed.data;

  try {
    const scopedPrisma = await getScopedPrisma();
    const company = await scopedPrisma.company.findUniqueOrThrow({ where: { id: companyId }, select: { ownerId: true } });
    await assertOwnScope(scope, company.ownerId, user);
    if (capaId) {
      const capa = await scopedPrisma.cAPA.findFirst({ where: { id: capaId } });
      if (!capa) return { formError: "الـCAPA غير موجود." };
    }

    await withScopedTransaction(async (tx) => {
      const kase = await tx.customerServiceCase.create({
        data: {
          orgId: user.orgId,
          companyId,
          ownerId: user.id,
          slaDeadline: slaDeadline ? new Date(slaDeadline) : undefined,
          rootCause: rootCause || undefined,
          capaId: capaId || undefined,
          currency: currency || undefined,
          ...rest,
        },
      });
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "customerServiceCase.created",
        entityType: "CustomerServiceCase",
        entityId: kase.id,
        afterValue: { companyId, capaId: capaId || null, ...rest },
      });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "createCustomerServiceCase", error: e });
    return { formError: "حصل خطأ أثناء إضافة حالة خدمة العملاء — حاول تاني." };
  }

  revalidatePath(`/companies/${companyId}`);
  return {};
}
