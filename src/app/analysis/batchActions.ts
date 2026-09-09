"use server";

import { redirect } from "next/navigation";
import { getScopedPrisma, withScopedTransaction } from "@/lib/scoped-prisma";
import { requireCurrentUser } from "@/lib/session";
import { requirePermission } from "@/lib/permissions";
import { logError, isNextControlFlowError, businessRuleMessage } from "@/lib/errorLog";
import { analyzeMarketWithAI } from "@/lib/ai/analyzeMarket";
import { analyzeCompetitorsWithAI } from "@/lib/ai/analyzeCompetitors";
import { saveAiMarketAnalysis } from "./actions";
import { saveAiCompetitors } from "@/app/competitors/actions";

/** حد أقصى للتركيبات (منتج × سوق) في الدفعة الواحدة — كل تركيبة بتستهلك 15-30 ثانية + عدة اعتمادات
 * Tavily، ومفيش queue حقيقي في المشروع (BACKLOG.md)، فلازم حد معقول يمنع دفعة تاخد ساعات. رقم واحد
 * قابل للتعديل بسهولة لو الاستخدام أثبت إنه محتاج يزيد. */
const MAX_PAIRS_PER_BATCH = 50;

export type BatchKind = "MarketAnalysis" | "Competitors";

export type StartBatchState = { formError?: string; batchId?: string };

/** بينشئ دفعة (Batch) + عنصر (Item) لكل تركيبة منتج×سوق نشطة في المنظمة — التشغيل الفعلي بيحصل
 * بعد كده عبر processNextBatchItem، مُستدعاة بـpolling من صفحة التقدّم (بلا queue حقيقي). */
export async function startBatch(kind: BatchKind, year: number): Promise<StartBatchState> {
  const user = await requireCurrentUser();
  try {
    await requirePermission(user.roleId, kind === "MarketAnalysis" ? "Analysis" : "Competitor", "Create");
    const prisma = await getScopedPrisma();

    // ⚠️ مش Promise.all — راجع BACKLOG.md (P2028).
    // status: "Verified" بس — مش أي منتج مسجّل. اتكشف حيًا (9 سبتمبر) إن الدفعة الشاملة كانت
    // بتحلّل منتجات اختبار/مكرّرة لسه Draft زي أي منتج حقيقي، وبتهدر كوتة AI على بيانات وهمية.
    // منتج بيتحوّل لـVerified بفورم /products/[id] بعد ما بياناته تتراجع وتتأكد.
    const products = await prisma.product.findMany({ where: { orgId: user.orgId, deletedAt: null, status: "Verified" }, select: { id: true } });
    const markets = await prisma.market.findMany({ where: { orgId: user.orgId, deletedAt: null }, select: { id: true } });

    const totalPairs = products.length * markets.length;
    if (totalPairs === 0) return { formError: "محتاج منتج بحالة \"Verified\" وسوق واحد على الأقل مسجَّلين — منتجات Draft متستبعدة من التحليل الشامل عمدًا." };
    if (totalPairs > MAX_PAIRS_PER_BATCH) {
      return {
        formError: `عدد التركيبات الحالي (${products.length} منتج × ${markets.length} سوق = ${totalPairs}) أكبر من الحد الأقصى المسموح (${MAX_PAIRS_PER_BATCH}) للدفعة الواحدة — قلّل عدد المنتجات أو الأسواق النشطة، أو شغّل الدفعة على دفعات.`,
      };
    }

    const batchId = await withScopedTransaction(async (tx) => {
      const batch = await tx.aiAnalysisBatch.create({
        data: { orgId: user.orgId, kind, year, totalPairs, createdBy: user.id },
      });
      await tx.aiAnalysisBatchItem.createMany({
        data: products.flatMap((p) => markets.map((m) => ({ orgId: user.orgId, batchId: batch.id, productId: p.id, marketId: m.id }))),
      });
      return batch.id;
    });

    return { batchId };
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    await logError({ orgId: user.orgId, userId: user.id, action: "startBatch", error: e });
    return { formError: businessRuleMessage(e, "حصل خطأ أثناء إنشاء الدفعة — حاول تاني.") };
  }
}

export type StartBatchFormState = { formError?: string };

/** غلاف حول startBatch متوافق مع useActionState (فورم بحقل year واحد) — بيحوّل مباشرة لصفحة
 * التقدّم عند النجاح. year مش بيتستخدم فعليًا في مسار Competitors (Competitor مالوش عمود year) —
 * محتفظ بيه في الفورم عشان تجربة استخدام موحّدة بين الزرارين. */
export async function startMarketAnalysisBatchAction(_prevState: StartBatchFormState, formData: FormData): Promise<StartBatchFormState> {
  const year = Number(formData.get("year"));
  const result = await startBatch("MarketAnalysis", year);
  if (result.formError) return { formError: result.formError };
  redirect(`/analysis/batches/${result.batchId}`);
}

export async function startCompetitorsBatchAction(_prevState: StartBatchFormState, formData: FormData): Promise<StartBatchFormState> {
  const year = Number(formData.get("year"));
  const result = await startBatch("Competitors", year);
  if (result.formError) return { formError: result.formError };
  redirect(`/analysis/batches/${result.batchId}`);
}

export type BatchItemView = {
  id: string;
  productId: string;
  marketId: string;
  status: string;
  resultId: string | null;
  errorMessage: string | null;
};

export type BatchView = {
  id: string;
  kind: string;
  status: string;
  totalPairs: number;
  succeededCount: number;
  failedCount: number;
  items: BatchItemView[];
};

async function loadBatchView(batchId: string, orgId: string, roleId: string) {
  const prisma = await getScopedPrisma();
  const batch = await prisma.aiAnalysisBatch.findFirstOrThrow({ where: { id: batchId, orgId } });
  await requirePermission(roleId, batch.kind === "MarketAnalysis" ? "Analysis" : "Competitor", "View");
  const items = await prisma.aiAnalysisBatchItem.findMany({ where: { batchId, orgId }, orderBy: { id: "asc" } });
  return { batch, items };
}

function toView(batch: { id: string; kind: string; status: string; totalPairs: number; succeededCount: number; failedCount: number }, items: BatchItemView[]): BatchView {
  return {
    id: batch.id,
    kind: batch.kind,
    status: batch.status,
    totalPairs: batch.totalPairs,
    succeededCount: batch.succeededCount,
    failedCount: batch.failedCount,
    items,
  };
}

export async function getBatchView(batchId: string): Promise<BatchView> {
  const user = await requireCurrentUser();
  const { batch, items } = await loadBatchView(batchId, user.orgId, user.roleId);
  return toView(batch, items);
}

/** بيعالج **تركيبة واحدة بس** من الدفعة في كل نداء — عمدًا، عشان يتفادى أي timeout (مفيش queue
 * حقيقي في المشروع). صفحة التقدّم بتنادي الدالة دي بـpolling (كل 2 ثانية) لحد ما الدفعة تخلص.
 * تركيبة واحدة تفشل ما بتوقفش الباقي — بتتسجّل Failed مع سبب واضح والمعالجة بتكمل. */
export async function processNextBatchItem(batchId: string): Promise<BatchView> {
  const user = await requireCurrentUser();
  const { batch, items } = await loadBatchView(batchId, user.orgId, user.roleId);

  const next = items.find((i) => i.status === "Pending");
  if (!next || batch.status === "Completed" || batch.status === "Cancelled") {
    return toView(batch, items);
  }

  const prisma = await getScopedPrisma();
  if (batch.status === "Pending") {
    await prisma.aiAnalysisBatch.update({ where: { id: batch.id }, data: { status: "Running" } });
  }

  // Claim ذري بـupdateMany (بدل update عادي) — بيمنع نداءين متزامنين (تابين مفتوحين، أو Strict
  // Mode في التطوير بيولّد نداءين للـeffect) من معالجة نفس التركيبة مرتين وزيادة العدّاد مرتين
  // (اتلاحظ حيًا: succeededCount+failedCount بقوا أكبر من totalPairs). لو حد تاني سبقنا وكلايم
  // التركيبة، claimed.count بيبقى 0 ونرجّع الحالة الحالية بلا معالجة إضافية.
  const claimed = await prisma.aiAnalysisBatchItem.updateMany({
    where: { id: next.id, status: "Pending" },
    data: { status: "Running", startedAt: new Date() },
  });
  if (claimed.count === 0) {
    return getBatchView(batchId);
  }

  let succeeded = false;
  let resultId: string | null = null;
  let errorMessage: string | null = null;
  try {
    // ⚠️ مش Promise.all — راجع BACKLOG.md (P2028).
    const product = await prisma.product.findFirst({ where: { id: next.productId, orgId: user.orgId, deletedAt: null } });
    const market = await prisma.market.findFirst({ where: { id: next.marketId, orgId: user.orgId, deletedAt: null } });
    if (!product || !market) throw new Error("المنتج أو السوق اتشال بعد ما اتحضّرت الدفعة.");

    if (batch.kind === "MarketAnalysis") {
      const result = await analyzeMarketWithAI(product, market, user.orgId);
      resultId = await saveAiMarketAnalysis(user.orgId, user.id, product, market, batch.year, result);
    } else {
      const results = await analyzeCompetitorsWithAI(product, market, user.orgId);
      resultId = results.length > 0 ? await saveAiCompetitors(user.orgId, user.id, product, market, results) : null;
      if (results.length === 0) errorMessage = "الذكاء الاصطناعي بحث فعليًا ومالقاش منافسين حقيقيين مؤكَّدين لهذه التركيبة.";
    }
    succeeded = errorMessage === null;
  } catch (e) {
    errorMessage = businessRuleMessage(e, "حصل خطأ غير متوقع أثناء التحليل.");
    await logError({ orgId: user.orgId, userId: user.id, action: "processNextBatchItem", error: e });
  }

  await withScopedTransaction(async (tx) => {
    await tx.aiAnalysisBatchItem.update({
      where: { id: next.id },
      data: { status: succeeded ? "Succeeded" : "Failed", resultId, errorMessage, completedAt: new Date() },
    });
    const updatedBatch = await tx.aiAnalysisBatch.update({
      where: { id: batch.id },
      data: succeeded ? { succeededCount: { increment: 1 } } : { failedCount: { increment: 1 } },
    });
    if (updatedBatch.succeededCount + updatedBatch.failedCount >= updatedBatch.totalPairs) {
      await tx.aiAnalysisBatch.update({ where: { id: batch.id }, data: { status: "Completed", completedAt: new Date() } });
    }
  });

  return getBatchView(batchId);
}
