import { prisma } from "./prisma";
import { getAuthenticatedUser } from "./supabase/server";
import type { Prisma } from "@/generated/prisma/client";

/**
 * أهم ملف لتفعيل RLS الفعلي عبر Prisma. الاتصال الخام (`src/lib/prisma.ts`) بيتم
 * بدور `postgres` (Superuser) اللي بيتخطى أي RLS Policy تلقائيًا — ده بالظبط
 * العيب اللي التقرير النهائي حذّر منه ("الموافقات الشكلية").
 *
 * الحل: كل استعلام من هنا بيتغلّف في معاملة (`$transaction`) بتعمل
 * `SET LOCAL ROLE authenticated` + `set_config('request.jwt.claims', ...)` **قبل**
 * ما تنفّذ الاستعلام الفعلي — نفس آلية Supabase الداخلية لـPostgREST، لكن يدويًا
 * عشان إحنا بنستخدم Prisma مباشرة مش PostgREST.
 *
 * الاستخدام: `const prisma = await getScopedPrisma();` في أول أي Server
 * Component/Action بيلمس بيانات حقيقية — بدل `import { prisma } from "@/lib/prisma"`.
 */
export async function getScopedPrisma(): Promise<typeof prisma> {
  const authUser = await getAuthenticatedUser();
  if (!authUser) {
    throw new Error("getScopedPrisma() اتنادى من غير جلسة مصادقة — لازم تسجّل دخول الأول.");
  }

  const claims = JSON.stringify({ sub: authUser.id, role: "authenticated" });

  const extended = prisma.$extends({
    name: "rls-context",
    query: {
      $allOperations: async ({ model, operation, args, query }) => {
        if (!model) {
          // عمليات بلا موديل (مثل $queryRaw مباشرة) — نادرة الاستخدام هنا، تمرّ عادي.
          return query(args);
        }
        const modelProp = model.charAt(0).toLowerCase() + model.slice(1);

        return prisma.$transaction(
          async (tx) => {
            await tx.$executeRawUnsafe(`SET LOCAL ROLE authenticated`);
            await tx.$executeRaw`SELECT set_config('request.jwt.claims', ${claims}, true)`;
            // @ts-expect-error -- الوصول الديناميكي للموديل مطلوب هنا؛ Prisma
            // بيوفّر النوع الصريح على مستوى الاستدعاء الأصلي (product.findMany...) مش هنا.
            return tx[modelProp][operation](args);
          },
          // maxWait/timeout أعلى من افتراضي Prisma (2s/5s) — اتلاحظ حيًا P2028 "Unable to
          // start a transaction in the given time" تحت ضغط بسيط (Next dev بيعيد compile +
          // نداءات متزامنة)، لأن الاتصال بيعدّي على pgbouncer (transaction pooling) مش على
          // Postgres مباشرة، فبطء لحظي في تسليم اتصال من الـpooler كافي يعدّي 2 ثانية بسهولة.
          { maxWait: 10_000, timeout: 15_000 }
        );
      },
    },
  });

  // ⚠️ تحويل نوع صريح لـ`typeof prisma` بدل ما نسيب TS يستنتج نوع $extends() الكامل —
  // بعد ما وحدة 5 زوّدت عدد الموديلات، النوع المُستنتَج بقى معقّد جدًا لدرجة "Excessive
  // stack depth" في ملفات تانية بتستخدم getScopedPrisma() (مشكلة معروفة في Prisma $extends
  // مع schemas كبيرة). الشكل الفعلي وقت التشغيل واحد — التحويل ده بيوصف نفس القيمة بنوع أبسط
  // TS يقدر يتعامل معاه، مش تغيير سلوك.
  return extended as unknown as typeof prisma;
}

export type ScopedTx = Prisma.TransactionClient;

/**
 * زي getScopedPrisma بس بتفتح transaction *واحدة* لكل عمليات الكتابة المتعددة اللي
 * لازم تنجح أو تترجع كلها مع بعض (مثال: قبول عرض سعر → إنشاء SalesOrder + SalesOrderLine
 * + تحديث حالة الصفقة). استخدمها لأي Server Action بتعمل أكتر من كتابة مترابطة —
 * getScopedPrisma العادي بيفتح transaction منفصلة لكل استعلام لوحده (لازمة RLS بس، مش ACID).
 */
export async function withScopedTransaction<T>(
  fn: (tx: ScopedTx) => Promise<T>
): Promise<T> {
  const authUser = await getAuthenticatedUser();
  if (!authUser) {
    throw new Error("withScopedTransaction() اتنادت من غير جلسة مصادقة — لازم تسجّل دخول الأول.");
  }
  const claims = JSON.stringify({ sub: authUser.id, role: "authenticated" });

  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL ROLE authenticated`);
      await tx.$executeRaw`SELECT set_config('request.jwt.claims', ${claims}, true)`;
      return fn(tx);
    },
    { maxWait: 10_000, timeout: 15_000 } // نفس سبب getScopedPrisma فوق (P2028 تحت ضغط pgbouncer).
  );
}
