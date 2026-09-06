"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { withScopedTransaction } from "@/lib/scoped-prisma";
import { requireCurrentUser } from "@/lib/session";
import { requirePermission } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { logError, isNextControlFlowError } from "@/lib/errorLog";

const LeadAssignmentRuleSchema = z.object({
  assignToUserId: z.string().uuid().optional().or(z.literal("")),
  assignToTeamId: z.string().uuid().optional().or(z.literal("")),
  priority: z.coerce.number().int().min(0).optional(),
});

export type LeadAssignmentRuleFormState = { errors?: Record<string, string[]>; formError?: string };

export async function createLeadAssignmentRule(_prevState: LeadAssignmentRuleFormState, formData: FormData): Promise<LeadAssignmentRuleFormState> {
  const parsed = LeadAssignmentRuleSchema.safeParse({
    assignToUserId: formData.get("assignToUserId") || undefined,
    assignToTeamId: formData.get("assignToTeamId") || undefined,
    priority: formData.get("priority") || undefined,
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const user = await requireCurrentUser();
  const { assignToUserId, assignToTeamId, ...rest } = parsed.data;
  try {
    await requirePermission(user.roleId, "LeadAssignmentRule", "Create");
    await withScopedTransaction(async (tx) => {
      const rule = await tx.leadAssignmentRule.create({
        data: {
          orgId: user.orgId,
          assignToUserId: assignToUserId || undefined,
          assignToTeamId: assignToTeamId || undefined,
          ...rest,
        },
      });
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "leadAssignmentRule.created",
        entityType: "LeadAssignmentRule",
        entityId: rule.id,
        afterValue: { assignToUserId: assignToUserId || null, assignToTeamId: assignToTeamId || null, ...rest },
      });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "createLeadAssignmentRule", error: e });
    return { formError: "حصل خطأ أثناء إضافة قاعدة التوزيع — حاول تاني." };
  }

  revalidatePath("/lead-rules");
  return {};
}
