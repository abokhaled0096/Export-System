-- تحليل الأسواق بالذكاء الاصطناعي — إضافة مصدر التحليل + تبرير Claude + المصادر المستخدمة.
-- إضافية بالكامل (بلا DROP)، آمنة على بيانات موجودة: source بيتحسب Manual افتراضيًا لكل الصفوف القديمة.

CREATE TYPE "AnalysisSource" AS ENUM ('Manual', 'AI');

ALTER TABLE "ProductMarketAnalysis" ADD COLUMN     "aiReasoning" TEXT,
ADD COLUMN     "aiSources" JSONB,
ADD COLUMN     "source" "AnalysisSource" NOT NULL DEFAULT 'Manual';
