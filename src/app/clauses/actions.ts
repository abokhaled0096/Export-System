"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { withScopedTransaction } from "@/lib/scoped-prisma";
import { requireCurrentUser } from "@/lib/session";
import { requirePermission } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { logError, isNextControlFlowError } from "@/lib/errorLog";

const CLAUSE_CATEGORIES = ["Payment", "Delivery", "Quality", "Claims", "ForceMajeure", "GoverningLaw", "Confidentiality", "Cancellation"] as const;
const CLAUSE_RISK_LEVELS = ["Low", "Medium", "High"] as const;

const ClauseSchema = z.object({
  title: z.string().trim().min(1, "العنوان مطلوب"),
  category: z.enum(CLAUSE_CATEGORIES),
  textAr: z.string().trim().optional().or(z.literal("")),
  textEn: z.string().trim().optional().or(z.literal("")),
  riskLevel: z.enum(CLAUSE_RISK_LEVELS),
  approvalRequired: z.coerce.boolean().optional(),
});

export type ClauseFormState = { errors?: Record<string, string[]>; formError?: string };

export async function createClause(_prevState: ClauseFormState, formData: FormData): Promise<ClauseFormState> {
  const parsed = ClauseSchema.safeParse({
    title: formData.get("title"),
    category: formData.get("category"),
    textAr: formData.get("textAr") || undefined,
    textEn: formData.get("textEn") || undefined,
    riskLevel: formData.get("riskLevel"),
    approvalRequired: formData.get("approvalRequired") === "on",
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const user = await requireCurrentUser();
  const { textAr, textEn, ...rest } = parsed.data;
  try {
    await requirePermission(user.roleId, "Clause", "Create");
    await withScopedTransaction(async (tx) => {
      const clause = await tx.clause.create({
        data: {
          orgId: user.orgId,
          textAr: textAr || undefined,
          textEn: textEn || undefined,
          ...rest,
        },
      });
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "clause.created",
        entityType: "Clause",
        entityId: clause.id,
        afterValue: { ...rest },
      });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "createClause", error: e });
    return { formError: "حصل خطأ أثناء إضافة البند — حاول تاني." };
  }

  revalidatePath("/clauses");
  return {};
}
