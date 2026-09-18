-- إصلاح عيب اتكشف بمراجعة ذاتية لعيوب أمس (18 سبتمبر): postPaymentAllocated (accounting.ts)
-- كان بيحسب فرق العملة "المحقَّق" وقت تخصيص الدفعة من سعر *إصدار الفاتورة الأصلي* دايمًا،
-- من غير ما يعرف حاجة عن أي إعادة تقييم "غير محقَّقة" اتسجّلت للفاتورة دي قبل كده
-- (revalueForeignCurrencyReceivablesPayables، fxRevaluation.ts). النتيجة: لو فاتورة اتعاد
-- تقييمها في فترة، وبعدين اتحصّلت (كاملة أو جزئيًا) في فترة تانية، جزء من فرق العملة كان بيتسجّل
-- مرتين (مرة "غير محقَّق" وقت إعادة التقييم، ومرة "محقَّق" وقت التحصيل نفسه)، وقيمة AR/AP
-- الوظيفية كانت بتفضل متضخّمة بلا تصفية كاملة أبدًا. الحل: عمود جديد بيسجّل الـExchangeRate.id
-- المستخدَم في آخر إعادة تقييم، عشان postPaymentAllocated يقدر يستخدمه (لو موجود) بدل بند
-- الإصدار الأصلي.

ALTER TABLE "Invoice" ADD COLUMN "lastFxRevaluationRateId" UUID;

ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_lastFxRevaluationRateId_fkey"
  FOREIGN KEY ("lastFxRevaluationRateId") REFERENCES "ExchangeRate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
