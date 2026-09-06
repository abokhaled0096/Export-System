"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { withScopedTransaction } from "@/lib/scoped-prisma";
import { requireCurrentUser } from "@/lib/session";
import { requirePermission, assertOwnScope } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { logError, isNextControlFlowError, businessRuleMessage } from "@/lib/errorLog";

const BUNDLABLE_QUOTE_STATUSES = ["Draft", "PendingApproval", "Sent"] as const;

const CreateBundleSchema = z.object({
  customerId: z.string().uuid("اختر عميل"),
  quoteIds: z.array(z.string().uuid()).min(1, "اختر عرض سعر واحد على الأقل"),
});

export type QuoteBundleFormState = { formError?: string };

/** تجميع عروض أسعار مستقلة (Deals مختلفة) في مستند واحد للعميل نفسه — كل Quote فاضل بمحرك
 * تسعيره الأصلي (Deal/DealScenario/walkAwayPrice) بلا أي تغيير، التجميع بصري/مستندي بس.
 * الـTrigger enforce_quote_bundle_same_customer بيتأكد من تطابق العميل على مستوى القاعدة. */
export async function createQuoteBundle(_prevState: QuoteBundleFormState, formData: FormData): Promise<QuoteBundleFormState> {
  const parsed = CreateBundleSchema.safeParse({
    customerId: formData.get("customerId"),
    quoteIds: formData.getAll("quoteIds"),
  });
  if (!parsed.success) return { formError: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" };

  const user = await requireCurrentUser();
  let bundleId: string;
  try {
    const scope = await requirePermission(user.roleId, "QuoteBundle", "Create");
    bundleId = await withScopedTransaction(async (tx) => {
      const quotes = await tx.quote.findMany({
        where: { id: { in: parsed.data.quoteIds }, orgId: user.orgId },
        include: { deal: { include: { opportunity: { select: { ownerId: true } } } } },
      });
      if (quotes.length !== parsed.data.quoteIds.length) throw new Error("فيه عرض سعر مش موجود ضمن اللي اخترتهم.");
      for (const q of quotes) {
        // كل عرض بيتحقق بملكيته لوحده — بلا الفحص ده، SalesRep (Own scope) كان يقدر يضم عروض
        // أسعار من صفقات مش بتاعته خالص لنفس العميل (اتكشف في مراجعة وحدة 2، 6 سبتمبر).
        await assertOwnScope(scope, q.deal.opportunity.ownerId, user);
        if (q.customerId !== parsed.data.customerId) throw new Error("كل عروض الأسعار في الحزمة لازم تكون لنفس العميل.");
        if (q.bundleId) throw new Error("فيه عرض سعر متضاف لحزمة تانية بالفعل — شيله من هناك الأول.");
        if (!(BUNDLABLE_QUOTE_STATUSES as readonly string[]).includes(q.status)) {
          throw new Error(`عرض السعر بحالة ${q.status} — العروض المقبولة/المرفوضة/المنتهية مينفعش تتضاف لحزمة.`);
        }
      }

      const bundle = await tx.quoteBundle.create({
        data: { orgId: user.orgId, customerId: parsed.data.customerId, createdBy: user.id },
      });
      // `bundleId: null` في الـwhere هنا مش تكرار للفحص فوق — ده حماية حقيقية ضد سباق حقيقي:
      // لو طلبين متزامنين بيحاولوا يضموا نفس العرض لحزمتين مختلفتين، الفحص فوق (SELECT) بيشوف
      // "null" للاتنين تحت READ COMMITTED قبل ما أي UPDATE يتنفّذ — بلا الشرط ده، آخر تحديث
      // بيكسب بصمت (updateMany عمياء بتنجح دايمًا)، وحزمة تانية بتفقد عرضها من غير أي خطأ ظاهر.
      const updated = await tx.quote.updateMany({ where: { id: { in: parsed.data.quoteIds }, bundleId: null }, data: { bundleId: bundle.id } });
      if (updated.count !== parsed.data.quoteIds.length) {
        throw new Error("فيه عرض سعر اتضاف لحزمة تانية في نفس اللحظة — حاول تاني.");
      }

      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "quoteBundle.created",
        entityType: "QuoteBundle",
        entityId: bundle.id,
        afterValue: { customerId: parsed.data.customerId, quoteIds: parsed.data.quoteIds },
      });
      return bundle.id;
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "createQuoteBundle", error: e });
    return { formError: businessRuleMessage(e, "حصل خطأ أثناء إنشاء الحزمة — حاول تاني.") };
  }

  revalidatePath("/quote-bundles");
  redirect(`/quote-bundles/${bundleId}`);
}

/** شيل عرض سعر من حزمته — لو الحزمة بقت فاضية بعد كده، تتشال تلقائيًا (تنظيف، مفيش فايدة
 * من حزمة فاضية تفضل معلّقة في القائمة). بيرجّع bundleDeleted عشان الواجهة تعرف ترجع
 * لصفحة القائمة لو الحزمة اللي كان بيتفرّج عليها اتشالت. */
export async function removeQuoteFromBundleAction(quoteId: string): Promise<{ bundleDeleted: boolean }> {
  const user = await requireCurrentUser();
  const scope = await requirePermission(user.roleId, "QuoteBundle", "Create");

  let bundleDeleted = false;
  let bundleIdForRevalidate: string | null = null;
  try {
    await withScopedTransaction(async (tx) => {
      const quote = await tx.quote.findUniqueOrThrow({
        where: { id: quoteId },
        include: { deal: { include: { opportunity: { select: { ownerId: true } } } } },
      });
      await assertOwnScope(scope, quote.deal.opportunity.ownerId, user);
      const bundleId = quote.bundleId;
      if (!bundleId) return;
      bundleIdForRevalidate = bundleId;

      await tx.quote.update({ where: { id: quoteId }, data: { bundleId: null } });
      await logAudit(tx, {
        orgId: user.orgId,
        userId: user.id,
        action: "quoteBundle.quoteRemoved",
        entityType: "QuoteBundle",
        entityId: bundleId,
        afterValue: { quoteId },
      });

      const remaining = await tx.quote.count({ where: { bundleId } });
      if (remaining === 0) {
        await tx.quoteBundle.delete({ where: { id: bundleId } });
        bundleDeleted = true;
      }
    });
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "removeQuoteFromBundleAction", error: e });
    throw new Error(businessRuleMessage(e, "حصل خطأ أثناء الشيل من الحزمة."));
  }

  revalidatePath("/quote-bundles");
  // لازم كمان صفحة تفاصيل الحزمة نفسها (اللي الزرار ده بيتضغط منها فعليًا) — revalidatePath
  // بالمسار العام بس مش كافي، الصفحة الديناميكية دي مسار مختلف تمامًا محتاج invalidation مستقل،
  // وإلا الصف المشال يفضل ظاهر في الشاشة (RSC cache قديم) لحد ما المستخدم يعمل reload يدوي.
  if (bundleIdForRevalidate) revalidatePath(`/quote-bundles/${bundleIdForRevalidate}`);
  return { bundleDeleted };
}
