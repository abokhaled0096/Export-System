"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { withScopedTransaction } from "@/lib/scoped-prisma";
import { requireCurrentUser } from "@/lib/session";
import { requirePermission } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { logError, isNextControlFlowError } from "@/lib/errorLog";

const ROUTE_CLASSIFICATIONS = ["Preferred", "Approved", "Conditional", "HighRisk", "Avoid", "UnderReview"] as const;
const TRANSPORT_MODES = ["Sea", "Air", "Road", "Rail", "Multimodal", "Courier"] as const;

const RouteSchema = z.object({
  originPort: z.string().trim().min(1, "ميناء المنشأ مطلوب"),
  destinationPort: z.string().trim().min(1, "ميناء الوصول مطلوب"),
  transportModes: z.array(z.enum(TRANSPORT_MODES)).optional(),
  transitPorts: z.string().trim().optional().or(z.literal("")),
  transshipmentCount: z.coerce.number().int().min(0).optional(),
  typicalTransitDays: z.coerce.number().int().min(0).optional(),
  worstTransitDays: z.coerce.number().int().min(0).optional(),
  weeklySailings: z.coerce.number().int().min(0).optional(),
  classification: z.enum(ROUTE_CLASSIFICATIONS),
});

export type RouteFormState = { errors?: Record<string, string[]>; formError?: string };

export async function createRoute(_prevState: RouteFormState, formData: FormData): Promise<RouteFormState> {
  const transitPortsRaw = (formData.get("transitPorts") as string | null) ?? "";
  const parsed = RouteSchema.safeParse({
    originPort: formData.get("originPort"),
    destinationPort: formData.get("destinationPort"),
    transportModes: formData.getAll("transportModes"),
    transitPorts: transitPortsRaw,
    transshipmentCount: formData.get("transshipmentCount") || undefined,
    typicalTransitDays: formData.get("typicalTransitDays") || undefined,
    worstTransitDays: formData.get("worstTransitDays") || undefined,
    weeklySailings: formData.get("weeklySailings") || undefined,
    classification: formData.get("classification"),
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const user = await requireCurrentUser();
  const { transitPorts, ...rest } = parsed.data;
  try {
    await requirePermission(user.roleId, "Route", "Create");
    await withScopedTransaction(async (tx) => {
      const route = await tx.route.create({
        data: {
          orgId: user.orgId,
          transitPorts: transitPorts
            ? transitPorts.split(",").map((p) => p.trim()).filter(Boolean)
            : [],
          transportModes: rest.transportModes ?? [],
          ...rest,
        },
      });
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "route.created",
        entityType: "Route",
        entityId: route.id,
        afterValue: { ...rest },
      });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "createRoute", error: e });
    return { formError: "حصل خطأ أثناء إضافة الخط الملاحي — حاول تاني." };
  }

  revalidatePath("/logistics/routes");
  return {};
}
