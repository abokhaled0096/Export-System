-- منع تكرار نفس الدولة (ISO 3166 countryCode) مرتين في نفس المنظمة عن طريق الغلط (اتكشف فعليًا:
-- مفيش تكرار حاليًا في البيانات الحية، اتحقق منه قبل كتابة الـmigration ده). فهرس جزئي (WHERE
-- "deletedAt" IS NULL) عشان أرشفة سوق وإضافة سوق جديد بنفس الكود بعدين تفضل ممكنة — نفس فلسفة
-- "أرشفة، لا حذف". بلا تمثيل مقابل في schema.prisma عمدًا (Prisma DSL مش بيدعم partial unique
-- index بـWHERE clause) — نفس نمط الـTriggers/RLS policies اللي بتتكتب يدويًا هنا فعلًا.
CREATE UNIQUE INDEX "Market_orgId_countryCode_active_key" ON "Market"("orgId", "countryCode") WHERE "deletedAt" IS NULL;
