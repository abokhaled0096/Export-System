"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getScopedPrisma, withScopedTransaction } from "@/lib/scoped-prisma";
import { requireCurrentUser } from "@/lib/session";
import { requirePermission, getPermissionScope } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { parseCsv } from "@/lib/csv";
import { logError, isNextControlFlowError, businessRuleMessage } from "@/lib/errorLog";
import { assertWorkflowTransitionAllowed } from "@/lib/workflow";
import { requestEntityCreation } from "@/lib/masterDataChangeRequest";
import { ProductSchema } from "@/lib/productSchema";

const monthsField = z
  .array(z.string())
  .transform((arr) => arr.map(Number))
  .pipe(z.array(z.number().int().min(1, "شهر غير صالح").max(12, "شهر غير صالح")))
  .optional();

export type ProductFormState = {
  errors?: Partial<Record<keyof z.infer<typeof ProductSchema>, string[]>>;
  formError?: string;
  duplicateWarning?: string;
};

export async function createProduct(
  _prevState: ProductFormState,
  formData: FormData
): Promise<ProductFormState> {
  const parsed = ProductSchema.safeParse({
    nameAr: formData.get("nameAr"),
    nameEn: formData.get("nameEn"),
    hsCode: formData.get("hsCode"),
    category: formData.get("category"),
    originCountry: formData.get("originCountry"),
    harvestSeason: formData.get("harvestSeason") || undefined,
    availableMonths: formData.getAll("availableMonths"),
    storageTempC: formData.get("storageTempC") || undefined,
    shelfLifeDays: formData.get("shelfLifeDays") || undefined,
    requiresRefrigeration: formData.get("requiresRefrigeration") === "on",
    confirmDuplicate: formData.get("confirmDuplicate") === "on",
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  // requireCurrentUser() بيعمل redirect() داخليًا لو الجلسة انتهت — لازم يكون برّه try/catch
  // (أو يتفحص digest بتاعه جوه catch) عشان الـredirect ميتبلعش. راجع src/lib/errorLog.ts.
  const user = await requireCurrentUser();
  const { confirmDuplicate, ...data } = parsed.data;

  // مفيش صلاحية إنشاء مباشر؟ لو عنده صلاحية "طلب إضافة"، يتسجّل الطلب بدل الرفض المباشر — نفس
  // نمط createCompany/createSupplier/createBankAccount (راجع decideMasterDataChangeRequestAction).
  if (!(await getPermissionScope(user.roleId, "Product", "Create"))) {
    if (!(await getPermissionScope(user.roleId, "MasterDataChangeRequest", "Create"))) {
      return { formError: "معندكش صلاحية إضافة منتج، ولا صلاحية طلب إضافة." };
    }
    try {
      await withScopedTransaction((tx) =>
        requestEntityCreation(tx, { orgId: user.orgId, userId: user.id, entityType: "Product", proposedChanges: parsed.data })
      );
    } catch (e) {
      if (isNextControlFlowError(e)) throw e;
      await logError({ orgId: user.orgId, userId: user.id, action: "createProduct.request", error: e });
      return { formError: "حصل خطأ أثناء تسجيل الطلب — حاول تاني." };
    }
    revalidatePath("/governance/change-requests");
    redirect("/governance/change-requests");
  }

  try {
    await requirePermission(user.roleId, "Product", "Create");
    const scopedPrisma = await getScopedPrisma();

    // تحذير ناعم (مش قيد صلب) لو منتج مشابه موجود فعلًا — نفس الـhsCode ممكن يتشارك فيه أكتر من
    // منتج حقيقي بطبيعته (كود HS تصنيف عام، مش معرّف منتج فريد — اتحقق فعليًا: "فراولة مجمدة"
    // و"منتج تجربة" بيانات حقيقية بنفس الـhsCode 0811.10)، فمينفعش يبقى @@unique في الـDB، لكن
    // برضو يستاهل تنبيه المستخدم قبل ما يكرّر بيانات بغلط بدل قيد صارم يمنعه.
    if (!confirmDuplicate) {
      const similar = await scopedPrisma.product.findFirst({
        where: {
          deletedAt: null,
          OR: [{ hsCode: data.hsCode }, { nameAr: data.nameAr }, { nameEn: { equals: data.nameEn, mode: "insensitive" } }],
        },
      });
      if (similar) {
        return {
          duplicateWarning: `فيه منتج مشابه مسجّل بالفعل: "${similar.nameAr}" (${similar.hsCode}) — لو ده مقصود (منتج تاني بنفس التصنيف)، أكّد وكمّل الحفظ.`,
        };
      }
    }

    await withScopedTransaction(async (tx) => {
      const product = await tx.product.create({
        data: { orgId: user.orgId, ...data, availableMonths: data.availableMonths ?? [], status: "Draft" },
      });
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "product.created",
        entityType: "Product",
        entityId: product.id,
        afterValue: data,
      });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "createProduct", error: e });
    return { formError: "حصل خطأ أثناء الحفظ — حاول تاني." };
  }

  revalidatePath("/products");
  redirect("/products");
}

const PRODUCT_STATUSES = ["Draft", "Verified", "NeedsReview"] as const;

const UpdateProductSchema = z.object({
  status: z.enum(PRODUCT_STATUSES),
  availableMonths: monthsField,
  storageTempC: z.coerce.number().min(-30).max(50).optional(),
});

export type UpdateProductFormState = {
  errors?: Partial<Record<keyof z.infer<typeof UpdateProductSchema>, string[]>>;
  formError?: string;
};

/** تعديل حالة التوثيق (Draft→Verified/NeedsReview) ومواسم التوفّر/حرارة التخزين بعد الإنشاء —
 * الحقول التلاتة دي كانت موجودة في الـschema بلا أي طريقة توصلها، اتكشف في مراجعة وحدة 1 (6 سبتمبر):
 * availableMonths بالذات بيتغذّى بيه prompt الذكاء الاصطناعي بتاع Competitor فكان دايمًا فاضي. */
export async function updateProduct(
  productId: string,
  _prevState: UpdateProductFormState,
  formData: FormData
): Promise<UpdateProductFormState> {
  const parsed = UpdateProductSchema.safeParse({
    status: formData.get("status"),
    availableMonths: formData.getAll("availableMonths"),
    storageTempC: formData.get("storageTempC") || undefined,
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const user = await requireCurrentUser();
  try {
    await requirePermission(user.roleId, "Product", "Edit");
    await withScopedTransaction(async (tx) => {
      const current = await tx.product.findUniqueOrThrow({ where: { id: productId }, select: { status: true } });
      // انتقال حالة حقيقي بقى — بس الأزواج المسموح بيها في جدول WorkflowDefinition (وحدة 9،
      // راجع STATUS.md 7 سبتمبر). كانت بلا أي فحص خالص قبل كده (أي حد عنده Product.Edit يقدر
      // يرجّع Verified لـDraft مباشرة بلا مراجعة). بلا فحص لو الحالة متغيّرتش (فورم واحد بيعدّل
      // status/availableMonths/storageTempC مع بعض).
      if (current.status !== parsed.data.status) {
        await assertWorkflowTransitionAllowed(tx, user.orgId, "Product", productId, current.status, parsed.data.status);
      }
      await tx.product.update({
        where: { id: productId },
        data: { ...parsed.data, availableMonths: parsed.data.availableMonths ?? [] },
      });
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "product.updated",
        entityType: "Product",
        entityId: productId,
        beforeValue: { status: current.status },
        afterValue: parsed.data,
      });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "updateProduct", error: e });
    return { formError: businessRuleMessage(e, "حصل خطأ أثناء التحديث — حاول تاني.") };
  }

  revalidatePath(`/products/${productId}`);
  return {};
}

const ArchiveProductSchema = z.string().uuid();

export async function archiveProduct(productId: string) {
  const parsed = ArchiveProductSchema.safeParse(productId);
  if (!parsed.success) throw new Error("معرّف منتج غير صالح.");

  const user = await requireCurrentUser();
  await requirePermission(user.roleId, "Product", "Edit");
  try {
    await withScopedTransaction(async (tx) => {
      await tx.product.update({
        where: { id: parsed.data },
        data: { deletedAt: new Date() },
      });
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "product.archived",
        entityType: "Product",
        entityId: parsed.data,
      });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "archiveProduct", error: e });
    throw new Error("حصل خطأ أثناء الأرشفة — حاول تاني.");
  }

  revalidatePath("/products");
  revalidatePath("/products/archived");
}

const RestoreProductSchema = z.string().uuid();

export async function restoreProduct(productId: string) {
  const parsed = RestoreProductSchema.safeParse(productId);
  if (!parsed.success) throw new Error("معرّف منتج غير صالح.");

  const user = await requireCurrentUser();
  await requirePermission(user.roleId, "Product", "Edit");
  try {
    await withScopedTransaction(async (tx) => {
      await tx.product.update({
        where: { id: parsed.data },
        data: { deletedAt: null },
      });
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "product.restored",
        entityType: "Product",
        entityId: parsed.data,
      });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "restoreProduct", error: e });
    throw new Error("حصل خطأ أثناء الاستعادة — حاول تاني.");
  }

  revalidatePath("/products");
  revalidatePath("/products/archived");
}

const ProductSpecificationSchema = z.object({
  version: z.coerce.number().int().positive().optional(),
  storageConditions: z.string().trim().optional().or(z.literal("")),
  shelfLifeDays: z.coerce.number().int().min(0).optional(),
  reviewDate: z.string().trim().optional().or(z.literal("")),
});

export type ProductSpecificationFormState = { errors?: Record<string, string[]>; formError?: string };

/** physicalParams/chemicalParams/microbiologicalParams/packagingSpec/labelSpec (jsonb) و approvedBy
 * بلا واجهة إدخال — نفس معاملة Farm.pesticideProgram (مفيش فورم بسيط مناسب لبيانات jsonb حرة). */
export async function createProductSpecification(
  productId: string,
  _prevState: ProductSpecificationFormState,
  formData: FormData
): Promise<ProductSpecificationFormState> {
  const parsed = ProductSpecificationSchema.safeParse({
    version: formData.get("version") || undefined,
    storageConditions: formData.get("storageConditions") || undefined,
    shelfLifeDays: formData.get("shelfLifeDays") || undefined,
    reviewDate: formData.get("reviewDate") || undefined,
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const user = await requireCurrentUser();
  const { storageConditions, reviewDate, ...rest } = parsed.data;
  try {
    await requirePermission(user.roleId, "ProductSpecification", "Create");
    await withScopedTransaction(async (tx) => {
      const spec = await tx.productSpecification.create({
        data: {
          orgId: user.orgId,
          productId,
          status: "Draft",
          storageConditions: storageConditions || undefined,
          reviewDate: reviewDate ? new Date(reviewDate) : undefined,
          ...rest,
        },
      });
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "productSpecification.created",
        entityType: "ProductSpecification",
        entityId: spec.id,
        afterValue: { productId, ...rest },
      });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "createProductSpecification", error: e });
    return { formError: "حصل خطأ أثناء إضافة المواصفة — حاول تاني." };
  }

  revalidatePath(`/products/${productId}`);
  return {};
}

const MAX_IMPORT_ROWS = 500;

export type ImportProductsState = {
  formError?: string;
  summary?: { created: number; failed: number; errors: { row: number; message: string }[] };
};

/**
 * استيراد جماعي من CSV — أعمدة الملف لازم تطابق تسميات تصدير `/products/export` بالظبط
 * (بحيث تصدير→تعديل بـExcel→استيراد يشتغل من غير أي تحويل يدوي). كل صف بيتعامل معاه لوحده
 * (transaction منفصلة، مش loop جوه transaction واحدة) عشان صف واحد غلط ميلغيش الصفوف
 * الصحيحة اللي قبله — نفس فلسفة "صف بيفشل، الباقي يكمل" في أدوات الاستيراد الجماعي المعتادة.
 */
export async function importProductsCsv(
  _prevState: ImportProductsState,
  formData: FormData
): Promise<ImportProductsState> {
  const user = await requireCurrentUser();
  try {
    await requirePermission(user.roleId, "Product", "Create");
  } catch {
    return { formError: "معندكش صلاحية إضافة منتجات." };
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
    const parsed = ProductSchema.safeParse({
      nameAr: raw["الاسم بالعربية"],
      nameEn: raw["Name (English)"],
      hsCode: raw["HS Code"],
      category: raw["الفئة"],
      originCountry: raw["بلد المنشأ"],
      harvestSeason: raw["موسم الحصاد"] || undefined,
      shelfLifeDays: raw["مدة الصلاحية (يوم)"] || undefined,
      requiresRefrigeration: raw["يحتاج تبريد"] === "true" || raw["يحتاج تبريد"] === "1",
    });
    if (!parsed.success) {
      rowErrors.push({ row: i + 2, message: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" });
      continue;
    }

    try {
      await withScopedTransaction(async (tx) => {
        const product = await tx.product.create({
          data: { orgId: user.orgId, ...parsed.data, status: "Draft" },
        });
        await logAudit(tx, {
          orgId: user.orgId,
          userId: user.id,
          action: "product.created",
          entityType: "Product",
          entityId: product.id,
          afterValue: { ...parsed.data, source: "csv-import" },
        });
      });
      created++;
    } catch (e) {
      if (isNextControlFlowError(e)) throw e;
      await logError({ orgId: user.orgId, userId: user.id, action: "importProductsCsv", error: e });
      rowErrors.push({ row: i + 2, message: "فشل الحفظ في قاعدة البيانات" });
    }
  }

  revalidatePath("/products");
  return { summary: { created, failed: rowErrors.length, errors: rowErrors.slice(0, 20) } };
}
