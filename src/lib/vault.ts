import { prisma } from "./prisma";

/**
 * تشفير عمودي حقيقي عبر Supabase Vault — التوصية الحالية من Supabase (بدل pgcrypto/pgsodium،
 * راجع BACKLOG.md § خلصان للمقارنة والمصادر). الجداول التجارية (Company/Supplier/BankAccount/
 * TransportTrip) بتخزّن `secretId` (UUID) بس، مش القيمة نفسها — نفس نمط `Document.fileUrl`
 * (path مش الملف). القيمة الفعلية بتتشفّر/تتفكّ من `vault.secrets`/`vault.decrypted_secrets`.
 *
 * ⚠️ سيرفر بس — دوال `vault.*` مقصورة على أدوار مميّزة (service_role/postgres)، مش `authenticated`
 * اللي RLS scoped queries بتستخدمه في كل مكان تاني بالمشروع. الاتصال الخام (`./prisma.ts`) بيشتغل
 * بدور `postgres` (Superuser) أصلًا، فقادر ينادي `vault.*` مباشرة بلا عميل Supabase منفصل —
 * نفس فلسفة `storage.ts` (service_role بس على السيرفر)، لكن عبر SQL مباشر مش REST API.
 *
 * ⚠️⚠️ `vault.secrets` جدول واحد عالمي على مستوى المشروع كله — **مفيش عزل RLS بين المنظمات
 * جواه أصلًا** (Vault مصمَّم لتخزين أسرار عامة، مش multi-tenant زي باقي جداول المشروع). العزل
 * الوحيد الفعلي هو إن `secretId` UUID عشوائي غير قابل للتخمين، ومفروض دايمًا يتقرا من صف
 * تجاري اتفلتر بالفعل بـRLS (مثلًا `scopedPrisma.contact.findFirst(...)`) — **ممنوع تمامًا**
 * تنادي `decryptSecret()` بـid جاي من مُدخَل مستخدم مباشر (query param, form field) بلا ما
 * يتأكد الأول إنه فعلاً بيرجع لصف تخص orgId المستخدم الحالي، وإلا أي مستخدم في أي منظمة يقدر
 * يقرا سر منظمة تانية لو حزر/سرّب الـUUID بطريقة ما.
 */

export async function encryptSecret(plaintext: string, description: string): Promise<string> {
  const rows = await prisma.$queryRaw<{ create_secret: string }[]>`
    SELECT vault.create_secret(${plaintext}, NULL, ${description}) AS create_secret
  `;
  return rows[0].create_secret;
}

export async function decryptSecret(secretId: string): Promise<string | null> {
  const rows = await prisma.$queryRaw<{ decrypted_secret: string }[]>`
    SELECT decrypted_secret FROM vault.decrypted_secrets WHERE id = ${secretId}::uuid
  `;
  return rows[0]?.decrypted_secret ?? null;
}

/** بتعدّل القيمة في نفس الـsecret الموجود — الـsecretId المخزَّن في الجدول التجاري يفضل زي ما هو. */
export async function updateSecret(secretId: string, plaintext: string): Promise<void> {
  await prisma.$executeRaw`SELECT vault.update_secret(${secretId}::uuid, ${plaintext})`;
}

export async function deleteSecret(secretId: string): Promise<void> {
  await prisma.$executeRaw`DELETE FROM vault.secrets WHERE id = ${secretId}::uuid`;
}
