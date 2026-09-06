"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { withScopedTransaction } from "@/lib/scoped-prisma";
import { requireCurrentUser } from "@/lib/session";
import { requirePermission } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { logError, isNextControlFlowError } from "@/lib/errorLog";

const PROVIDER_TYPES = [
  "ShippingLine", "FreightForwarder", "TruckingCompany", "CustomsBroker", "PortAgent", "Warehouse", "Surveyor", "InsuranceCompany", "Courier", "ColdStorage", "ContainerDepot",
] as const;
const PROVIDER_STATUSES = ["Preferred", "Approved", "Conditional", "UnderReview", "Suspended", "Blacklisted"] as const;

const ServiceProviderSchema = z.object({
  providerType: z.enum(PROVIDER_TYPES),
  name: z.string().trim().min(1, "اسم المزوّد مطلوب"),
  country: z.string().trim().optional().or(z.literal("")),
  onTimePerformance: z.coerce.number().min(0).max(100).optional(),
  invoiceAccuracy: z.coerce.number().min(0).max(100).optional(),
  status: z.enum(PROVIDER_STATUSES),
});

export type ServiceProviderFormState = { errors?: Record<string, string[]>; formError?: string };

export async function createServiceProvider(_prevState: ServiceProviderFormState, formData: FormData): Promise<ServiceProviderFormState> {
  const parsed = ServiceProviderSchema.safeParse({
    providerType: formData.get("providerType"),
    name: formData.get("name"),
    country: formData.get("country") || undefined,
    onTimePerformance: formData.get("onTimePerformance") || undefined,
    invoiceAccuracy: formData.get("invoiceAccuracy") || undefined,
    status: formData.get("status"),
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const user = await requireCurrentUser();
  const { country, ...rest } = parsed.data;
  try {
    await requirePermission(user.roleId, "ServiceProvider", "Create");
    await withScopedTransaction(async (tx) => {
      const provider = await tx.serviceProvider.create({
        data: { orgId: user.orgId, country: country || undefined, ...rest },
      });
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "serviceProvider.created",
        entityType: "ServiceProvider",
        entityId: provider.id,
        afterValue: { country: country || null, ...rest },
      });
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "createServiceProvider", error: e });
    return { formError: "حصل خطأ أثناء إضافة مزوّد الخدمة — حاول تاني." };
  }

  revalidatePath("/logistics/providers");
  return {};
}
