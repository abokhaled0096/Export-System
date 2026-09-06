-- PDPL (قانون حماية البيانات المصري) — تتبّع الموافقة ومحو حقيقي (Anonymization) لجهات الاتصال.
-- راجع src/lib/pdpl.ts وCLAUDE.md § مواعيد نهائية قانونية.
ALTER TABLE "Contact" ADD COLUMN     "consentGiven" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Contact" ADD COLUMN     "consentAt" TIMESTAMP(3);
ALTER TABLE "Contact" ADD COLUMN     "erasedAt" TIMESTAMP(3);
