"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { withScopedTransaction } from "@/lib/scoped-prisma";
import { requireCurrentUser } from "@/lib/session";
import { requirePermission } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { logError, isNextControlFlowError } from "@/lib/errorLog";

const DOCUMENT_TYPES = [
  "Quotation", "ProformaInvoice", "CommercialInvoice", "PackingList", "SalesContract", "SalesConfirmation", "TechnicalDataSheet", "COA", "Declaration", "PriceList", "EmailDraft",
] as const;
const DOCUMENT_LANGUAGES = ["Arabic", "English", "Bilingual"] as const;
const TEMPLATE_STATUSES = ["Draft", "Approved", "Archived"] as const;

const TemplateSchema = z.object({
  documentType: z.enum(DOCUMENT_TYPES),
  language: z.enum(DOCUMENT_LANGUAGES),
  marketId: z.string().uuid().optional().or(z.literal("")),
  customerId: z.string().uuid().optional().or(z.literal("")),
  version: z.coerce.number().int().min(1).optional(),
  status: z.enum(TEMPLATE_STATUSES),
});

export type TemplateFormState = { errors?: Record<string, string[]>; formError?: string };

export async function createTemplate(_prevState: TemplateFormState, formData: FormData): Promise<TemplateFormState> {
  const parsed = TemplateSchema.safeParse({
    documentType: formData.get("documentType"),
    language: formData.get("language"),
    marketId: formData.get("marketId") || undefined,
    customerId: formData.get("customerId") || undefined,
    version: formData.get("version") || undefined,
    status: formData.get("status"),
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const user = await requireCurrentUser();
  const { marketId, customerId, ...rest } = parsed.data;
  try {
    await requirePermission(user.roleId, "Template", "Create");
    await withScopedTransaction(async (tx) => {
      const template = await tx.template.create({
        data: {
          orgId: user.orgId,
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
