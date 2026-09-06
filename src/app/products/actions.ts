"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { withScopedTransaction } from "@/lib/scoped-prisma";
import { requireCurrentUser } from "@/lib/session";
import { requirePermission } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { parseCsv } from "@/lib/csv";
import { logError, isNextControlFlowError } from "@/lib/errorLog";

const ProductSchema = z.object({
  nameAr: z.string().trim().min(2, "الاسم بالعربية لازم يكون حرفين على الأقل"),
  nameEn: z.string().trim().min(2, "الاسم بالإنجليزية لازم يكون حرفين على الأقل"),
  hsCode: z.string().trim().min(4, "HS Code غير صالح"),
  category: z.string().trim().min(1, "الفئة مطلوبة"),
  originCountry: z.string().trim().min(1, "بلد المنشأ مطلوب"),
  harvestSeason: z.string().trim().optional(),
  shelfLifeDays: z.coerce.number().int().positive().optional(),
  requiresRefrigeration: z.coerce.boolean().optional(),
});

export type ProductFormState = {
  errors?: Partial<Record<keyof z.infer<typeof ProductSchema>, string[]>>;
  formError?: string;
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
    shelfLifeDays: formData.get("shelfLifeDays") || undefined,
    requiresRefrigeration: formData.get("requiresRefrigeration") === "on",
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  // requireCurrentUser() بيعمل redirect() داخليًا لو الجلسة انتهت — لازم يكون برّه try/catch
  // (أو يتفحص digest بتاعه جوه catch) عشان الـredirect ميتبلعش. راجع src/lib/errorLog.ts.
  const user = await requireCurrentUser();
  try {
    await requirePermission(user.roleId, "Product", "Create");
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
        afterValue: parsed.data,
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

const PRODUCT_SPECIFICATION_STATUSES = [
  "Draft", "InternalReview", "CustomerReview", "CustomerApproved", "QualityApproved", "Superseded", "Expired",
] as const;

const ProductSpecificationSchema = z.object({
  version: z.coerce.number().int().positive().optional(),
  status: z.enum(PRODUCT_SPECIFICATION_STATUSES),
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
    status: formData.get("status"),
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
