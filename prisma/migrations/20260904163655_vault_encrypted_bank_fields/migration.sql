-- تفعيل التشفير الفعلي للحقول البنكية/الشخصية الـ🔒 اللي كانت Bytes? بلا آلية تشفير حقيقية —
-- قرار كان موثّق كمؤجَّل في BACKLOG.md P2. الآلية المختارة: Supabase Vault (توصية Supabase
-- الحالية، بدل pgcrypto/pgsodium — راجع BACKLOG.md § خلصان للمقارنة والمصادر). العمود بقى
-- بيخزّن secretId (UUID) بيشاور على vault.secrets، مش القيمة المشفّرة مباشرة (نفس نمط
-- Document.fileUrl). الأعمدة القديمة اتحذفت بأمان — مفيش أي واجهة إدخال كتبت فيها قط.
ALTER TABLE "BankAccount" DROP COLUMN "accountNumber",
DROP COLUMN "iban",
DROP COLUMN "swift",
ADD COLUMN     "accountNumberSecretId" UUID,
ADD COLUMN     "ibanSecretId" UUID,
ADD COLUMN     "swiftSecretId" UUID;

ALTER TABLE "Company" DROP COLUMN "bankAccountName",
DROP COLUMN "bankIBAN",
DROP COLUMN "bankSWIFT",
ADD COLUMN     "bankAccountNameSecretId" UUID,
ADD COLUMN     "bankIBANSecretId" UUID,
ADD COLUMN     "bankSWIFTSecretId" UUID;

ALTER TABLE "Supplier" DROP COLUMN "bankAccountName",
DROP COLUMN "bankIBAN",
ADD COLUMN     "bankAccountNameSecretId" UUID,
ADD COLUMN     "bankIBANSecretId" UUID;

ALTER TABLE "TransportTrip" DROP COLUMN "driverPhone",
ADD COLUMN     "driverPhoneSecretId" UUID;
