"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getScopedPrisma, withScopedTransaction } from "@/lib/scoped-prisma";
import { requireCurrentUser } from "@/lib/session";
import { requirePermission } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { logError, isNextControlFlowError } from "@/lib/errorLog";

const DOCUMENT_TYPES = [
  "Quotation", "ProformaInvoice", "CommercialInvoice", "PackingList", "SalesContract", "SalesConfirmation", "TechnicalDataSheet", "COA", "Declaration", "PriceList", "EmailDraft",
] as const;
const DOCUMENT_LANGUAGES = ["Arabic", "English", "Bilingual"] as const;

const TemplateSchema = z.object({
  documentType: z.enum(DOCUMENT_TYPES, "اختار نوع مستند صحيح"),
  language: z.enum(DOCUMENT_LANGUAGES, "اختار لغة مستند صحيحة"),
  marketId: z.string().uuid().optional().or(z.literal("")),
  customerId: z.string().uuid().optional().or(z.literal("")),
  version: z.coerce.number().int().min(1, "لازم يكون 1 أو أكتر").optional(),
});

export type TemplateFormState = { errors?: Record<string, string[]>; formError?: string };

export async function createTemplate(_prevState: TemplateFormState, formData: FormData): Promise<TemplateFormState> {
  const parsed = TemplateSchema.safeParse({
    documentType: formData.get("documentType"),
    language: formData.get("language"),
    marketId: formData.get("marketId") || undefined,
    customerId: formData.get("customerId") || undefined,
    version: formData.get("version") || undefined,
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const user = await requireCurrentUser();
  const { marketId, customerId, ...rest } = parsed.data;
  try {
    await requirePermission(user.roleId, "Template", "Create");
    // marketId/customerId اختياريين وبيتعرضوا بـ`?.` في /templates (t.market?.countryNameAr,
    // t.customer?.legalName) فمفيش خطر كسر صفحة هنا — لكن بلا الفحص ده، أي id عابر للمنظمة كان
    // ينفع يتسجّل ويربط قالب المنظمة بعميل/سوق منظمة تانية بصمت (تلوّث بيانات، اتكشف في إعادة
    // مراجعة وحدة 4، 7 سبتمبر). ⚠️ مش Promise.all — راجع BACKLOG.md (P2028).
    const scopedPrisma = await getScopedPrisma();
    if (marketId) {
      const market = await scopedPrisma.market.findFirst({ where: { id: marketId } });
      if (!market) return { formError: "السوق غير موجود." };
    }
    if (customerId) {
      const customer = await scopedPrisma.company.findFirst({ where: { id: customerId } });
      if (!customer) return { formError: "العميل غير موجود." };
    }
    await withScopedTransaction(async (tx) => {
      const template = await tx.template.create({
        data: {
          orgId: user.orgId,
          status: "Draft",
          marketId: marketId || undefined,
          customerId: customerId || undefined,
          ...rest,
        },
      });
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "template.created",
        entityType: "Template",
        entityId: template.id,
        afterValue: { marketId: marketId || null, customerId: customerId || null, ...rest },
      });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "createTemplate", error: e });
    return { formError: "حصل خطأ أثناء إضافة القالب — حاول تاني." };
  }

  revalidatePath("/templates");
  return {};
}
