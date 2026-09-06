"use server";

import { revalidatePath } from "next/cache";
import { requireCurrentUser } from "@/lib/session";
import { revokeMySession } from "@/lib/authSessions";
import { getScopedPrisma } from "@/lib/scoped-prisma";
import { logAudit } from "@/lib/audit";
import { logError, isNextControlFlowError } from "@/lib/errorLog";

export async function revokeSessionAction(sessionId: string) {
  const user = await requireCurrentUser();

  try {
    await revokeMySession(user.id, sessionId);
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "revokeSessionAction", error: e });
    throw new Error("حصل خطأ أثناء إلغاء الجلسة — حاول تاني.");
  }

  // تسجيل التدقيق برّه transaction الحذف عمدًا (auth.sessions قاعدة مختلفة تمامًا عن
  // public.AuditLog RLS، مش ممكن تتلف في نفس الـtransaction) — بـtry/catch مستقل ومقصود:
  // الحذف فوق نجح بالفعل، فمفيش داعي نبلّغ المستخدم بـ"حصل خطأ" على عملية خلصت صح لمجرد إن
  // سجل التدقيق فشل. أسوأ حالة: الإلغاء نجح بلا سجل تدقيق (بيتسجّل في ErrorLog للمتابعة).
  try {
    const scopedPrisma = await getScopedPrisma();
    await logAudit(scopedPrisma, {
      orgId: user.orgId,
      userId: user.id,
      action: "authSession.revoked",
      entityType: "AuthSession",
      entityId: sessionId,
    });
  } catch (e) {
    await logError({ orgId: user.orgId, userId: user.id, action: "revokeSessionAction.auditLog", error: e });
  }

  revalidatePath("/account/sessions");
}
