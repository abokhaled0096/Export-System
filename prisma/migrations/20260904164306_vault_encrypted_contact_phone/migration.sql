-- عاشر حقل 🔒 اتلقط في مراجعة تكميلية بعد migration الحقول البنكية (20260904163655) — Contact.phone
-- كان بره نفس الفحص الأول بالغلط. نفس النمط بالحرف: تحويل لـsecretId (UUID) يشاور على
-- vault.secrets. الجدول اتفحص مباشرة قبل الـmigration — صفر صف فيه phone غير NULL.
ALTER TABLE "Contact" DROP COLUMN "phone",
ADD COLUMN     "phoneSecretId" UUID;
