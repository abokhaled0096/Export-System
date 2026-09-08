-- إعدادات ذكاء اصطناعي قابلة للتعديل من /admin/ai-settings بدل ما تكون مثبَّتة في الكود
-- (مفتاح OPENAI_API_KEY واسم الموديل كانا ثابتين في src/lib/ai/analyzeMarket.ts). الثلاثة
-- أعمدة nullable — فاضية = استخدم .env + gpt-4o-mini الافتراضي (توافق خلفي كامل بلا فعل مطلوب).
-- aiApiKeySecretId بيسجّل UUID بس بيشاور على secret مشفّر في Supabase Vault، نفس نمط
-- Supplier.bankIBANSecretId/BankAccount.ibanSecretId — القيمة الحقيقية أبدًا ماتتخزّنش هنا.
ALTER TABLE "Organization" ADD COLUMN "aiApiKeySecretId" UUID;
ALTER TABLE "Organization" ADD COLUMN "aiBaseUrl" TEXT;
ALTER TABLE "Organization" ADD COLUMN "aiModel" TEXT;
