-- SalesTarget.period فاضل نص حر للعرض ("سبتمبر 2026") — بلا صيغة موحّدة قابلة للتحليل بأمان،
-- فمفيش طريقة نحسب actualValue منه. periodStart/periodEnd هما المدى الفعلي اللي محرك التجميع
-- الجديد (src/lib/salesTargetEngine.ts) بيستخدمه. أهداف قديمة بلاهم تفضل actualValue = null.
ALTER TABLE "SalesTarget" ADD COLUMN     "periodEnd" TIMESTAMP(3),
ADD COLUMN     "periodStart" TIMESTAMP(3);
