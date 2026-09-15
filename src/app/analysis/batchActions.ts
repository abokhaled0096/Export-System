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

export type StartBatchOptions = {
  /** فاضي/undefined = كل المنتجات Verified. غير فاضي = بس المنتجات المختارة (لازم يكونوا Verified برضه). */
  productIds?: string[];
  /** فاضي/undefined = كل الأسواق. */
  marketIds?: string[];
  /** false (الافتراضي) = تركيبة عندها تحليل نشط لسه صالح (validUntil في المستقبل) بتتستبعد تلقائيًا
   * توفيرًا لاستدعاءات AI. true = يتجاهل ده ويعيد تحليل كل حاجة حتى لو حديثة. */
  forceRefresh?: boolean;
};

/** بينشئ دفعة (Batch) + عنصر (Item) لكل تركيبة منتج×سوق مختارة — التشغيل الفعلي بيحصل بعد كده
 * عبر processNextBatchItem، مُستدعاة بـpolling من صفحة التقدّم (بلا queue حقيقي). */
export async function startBatch(kind: BatchKind, year: number, options: StartBatchOptions = {}): Promise<StartBatchState> {
  const user = await requireCurrentUser();
  try {
    await requirePermission(user.roleId, kind === "MarketAnalysis" ? "Analysis" : "Competitor", "Create");
    const prisma = await getScopedPrisma();

    // ⚠️ مش Promise.all — راجع BACKLOG.md (P2028).
    // status: "Verified" بس — مش أي منتج مسجّل. اتكشف حيًا (9 سبتمبر) إن الدفعة الشاملة كانت
    // بتحلّل منتجات اختبار/مكرّرة لسه Draft زي أي منتج حقيقي، وبتهدر كوتة AI على بيانات وهمية.
    // منتج بيتحوّل لـVerified بفورم /products/[id] بعد ما بياناته تتراجع وتتأكد.
    const productWhere = { orgId: user.orgId, deletedAt: null, status: "Verified" as const, ...(options.productIds?.length ? { id: { in: options.productIds } } : {}) };
    const marketWhere = { orgId: user.orgId, deletedAt: null, ...(options.marketIds?.length ? { id: { in: options.marketIds } } : {}) };
    const products = await prisma.product.findMany({ where: productWhere, select: { id: true } });
    const markets = await prisma.market.findMany({ where: marketWhere, select: { id: true } });

    let pairs = products.flatMap((p) => markets.map((m) => ({ productId: p.id, marketId: m.id })));
    let skippedFreshCount = 0;

    // تركيبة عندها تحليل نشط لسه صالح (validUntil في المستقبل) بتتستبعد تلقائيًا — مفيش داعي
    // نستهلك بحث Tavily + نداءات AI على تحليل حديث أصلًا. Competitor مالوش validUntil/versioning
    // زي ProductMarketAnalysis (كيانات إضافية مش نسخة واحدة نشطة)، فالفلترة دي لـMarketAnalysis بس.
    if (!options.forceRefresh && kind === "MarketAnalysis" && pairs.length > 0) {
      const fresh = await prisma.productMarketAnalysis.findMany({
        where: {
          orgId: user.orgId,
          supersededAt: null,
          validUntil: { gt: new Date() },
          productId: { in: products.map((p) => p.id) },
          marketId: { in: markets.map((m) => m.id) },
        },
        select: { productId: true, marketId: true },
      });
      const freshSet = new Set(fresh.map((f) => `${f.productId}:${f.marketId}`));
      const before = pairs.length;
      pairs = pairs.filter((p) => !freshSet.has(`${p.productId}:${p.marketId}`));
      skippedFreshCount = before - pairs.length;
    }

    const totalPairs = pairs.length;
    if (totalPairs === 0) {
      return {
        formError:
          skippedFreshCount > 0
            ? `كل التركيبات المختارة (${skippedFreshCount}) عندها تحليل حديث لسه صالح — فعّل "أعد تحليل حتى الحديث" لو عايز تجبر إعادة التحليل.`
            : "محتاج منتج بحالة \"Verified\" وسوق واحد على الأقل مسجَّلين — منتجات Draft متستبعدة من التحليل الشامل عمدًا.",
      };
    }
    if (totalPairs > MAX_PAIRS_PER_BATCH) {
      return {
        formError: `عدد التركيبات الحالي (${totalPairs}) أكبر من الحد الأقصى المسموح (${MAX_PAIRS_PER_BATCH}) للدفعة الواحدة — قلّل الاختيار، أو شغّل الدفعة على دفعات.`,
      };
    }

    const batchId = await withScopedTransaction(async (tx) => {
      const batch = await tx.aiAnalysisBatch.create({
        data: { orgId: user.orgId, kind, year, totalPairs, createdBy: user.id },
      });
      await tx.aiAnalysisBatchItem.createMany({
        data: pairs.map((p) => ({ orgId: user.orgId, batchId: batch.id, productId: p.productId, marketId: p.marketId })),
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

function readBatchOptionsFromForm(formData: FormData): StartBatchOptions {
  return {
    productIds: formData.getAll("productIds").map(String).filter(Boolean),
    marketIds: formData.getAll("marketIds").map(String).filter(Boolean),
    forceRefresh: formData.get("forceRefresh") === "on",
  };
}

/** غلاف حول startBatch متوافق مع useActionState — بيحوّل مباشرة لصفحة التقدّم عند النجاح. year
 * مش بيتستخدم فعليًا في مسار Competitors (Competitor مالوش عمود year) — محتفظ بيه في الفورم
 * عشان تجربة استخدام موحّدة بين الزرارين. productIds/marketIds فاضيين = كل الحالي (توافق خلفي). */
export async function startMarketAnalysisBatchAction(_prevState: StartBatchFormState, formData: FormData): Promise<StartBatchFormState> {
  const year = Number(formData.get("year"));
  const result = await startBatch("MarketAnalysis", year, readBatchOptionsFromForm(formData));
  if (result.formError) return { formError: result.formError };
  redirect(`/analysis/batches/${result.batchId}`);
}

export async function startCompetitorsBatchAction(_prevState: StartBatchFormState, formData: FormData): Promise<StartBatchFormState> {
  const year = Number(formData.get("year"));
  const result = await startBatch("Competitors", year, readBatchOptionsFromForm(formData));
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

/** بيرجّع كل تركيبة "Failed" في دفعة خلصت لـ"Pending" تاني، بدل ما تحتاج تبدأ دفعة جديدة من
 * الصفر (وتعيد تحليل التركيبات اللي نجحت بالفعل من غير داعي). الدفعة ترجع "Running" والصفحة
 * بتكمل الـpolling عادي من نفس الرابط. */
export async function retryFailedBatchItemsAction(batchId: string): Promise<void> {
  const user = await requireCurrentUser();
  const { batch } = await loadBatchView(batchId, user.orgId, user.roleId);
  await requirePermission(user.roleId, batch.kind === "MarketAnalysis" ? "Analysis" : "Competitor", "Create");

  const prisma = await getScopedPrisma();
  const reset = await prisma.aiAnalysisBatchItem.updateMany({
    where: { batchId, orgId: user.orgId, status: "Failed" },
    data: { status: "Pending", startedAt: null, completedAt: null, errorMessage: null, resultId: null },
  });
  if (reset.count > 0) {
    await prisma.aiAnalysisBatch.update({
      where: { id: batchId },
      data: { status: "Running", failedCount: { decrement: reset.count }, completedAt: null },
    });
  }

  redirect(`/analysis/batches/${batchId}`);
}

/** لو تركيبة فضلت "Running" أكتر من كده، السيرفر وقع أو المتصفح اتقفل *أثناء* معالجتها فعليًا
 * (مش بس بعدها) — أعلى بكتير من أطول وقت معالجة حقيقي اتلاحظ (~2-3 دقايق حتى مع retries). */
const STUCK_RUNNING_THRESHOLD_MS = 10 * 60 * 1000;

/** بيعالج **تركيبة واحدة بس** من الدفعة في كل نداء — عمدًا، عشان يتفادى أي timeout (مفيش queue
 * حقيقي في المشروع). صفحة التقدّم بتنادي الدالة دي بـpolling (كل 2 ثانية) لحد ما الدفعة تخلص.
 * تركيبة واحدة تفشل ما بتوقفش الباقي — بتتسجّل Failed مع سبب واضح والمعالجة بتكمل. */
export async function processNextBatchItem(batchId: string): Promise<BatchView> {
  const user = await requireCurrentUser();
  const { batch, items: initialItems } = await loadBatchView(batchId, user.orgId, user.roleId);

  if (batch.status === "Completed" || batch.status === "Cancelled") {
    return toView(batch, initialItems);
  }

  const prisma = await getScopedPrisma();

  // استرداد أي تركيبة عالقة في Running للأبد — كانت بتفضل كده بلا أي مسار رجوع لو حد قفل التاب
  // أو السيرفر وقع وسط معالجتها (اتلاحظ حيًا فعليًا واحتاج تصليح يدوي مباشر على القاعدة).
  const stuckThreshold = new Date(Date.now() - STUCK_RUNNING_THRESHOLD_MS);
  const reclaimed = await prisma.aiAnalysisBatchItem.updateMany({
    where: { batchId, orgId: user.orgId, status: "Running", startedAt: { lt: stuckThreshold } },
    data: { status: "Pending", startedAt: null },
  });
  const items = reclaimed.count > 0 ? (await loadBatchView(batchId, user.orgId, user.roleId)).items : initialItems;

  const next = items.find((i) => i.status === "Pending");
  if (!next) {
    return toView(batch, items);
  }

  if (batch.status === "Pending") {
    await prisma.aiAnalysisBatch.update({ where: { id: batch.id }, data: { status: "Running" } });
  }

  // Claim ذري بـupdateMany (بدل update عادي) — بيمنع نداءين متزامنين (تابين مفتوحين، أو Strict
  // Mode في التطوير بيولّد نداءين للـeffect) من معالجة نفس التركيبة مرتين وزيادة العدّاد مرتين
  // (اتلاحظ حيًا: succeededCount+failedCount بقوا أكبر من totalPairs). لو حد تاني سبقنا وكلايم
  // التركيبة، claimed.count بيبقى 0 ونرجّع الحالة الحالية بلا معالجة إضافية.
  // claimedAt بيتخزّن عشان يُستخدم كـfencing token وقت الكتابة النهائية تحت — لو نداء تاني (أبطأ
  // من حد الاسترداد فوق) استرجع التركيبة دي وعالجها من الأول، claimedAt بتاعنا هيبقى قديم ومش
  // مطابق للـstartedAt الجديد، فكتابتنا النهائية هتتجاهَل بدل ما تتراكب فوق نتيجة أحدث أو تزوّد
  // العدّاد مرتين. ده سيناريو نادر بس ممكن نظريًا: موديل متعدد fallback + retries على كل واحد
  // ممكن يعدّي نظريًا حد الـ10 دقايق (راجع STUCK_RUNNING_THRESHOLD_MS)، فالتأمين ده مش زيادة.
  const claimedAt = new Date();
  const claimed = await prisma.aiAnalysisBatchItem.updateMany({
    where: { id: next.id, status: "Pending" },
    data: { status: "Running", startedAt: claimedAt },
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
    // status+startedAt سوا في الشرط (مش id بس) — fencing token. لو نداء تاني استرجع التركيبة دي
    // (claimedAt بتاعنا بقى قديم) وعالجها من الأول، الكتابة دي بترجع count=0 ومفيش عدّاد بيتزوّد
    // مرتين ولا نتيجة أحدث بتتكتب فوقها نتيجة قديمة.
    const finalized = await tx.aiAnalysisBatchItem.updateMany({
      where: { id: next.id, status: "Running", startedAt: claimedAt },
      data: { status: succeeded ? "Succeeded" : "Failed", resultId, errorMessage, completedAt: new Date() },
    });
    if (finalized.count === 0) return;

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
