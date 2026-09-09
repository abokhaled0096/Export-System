-- عمود يعلّم أي تحليل AI اختلف فيه opportunityScore/riskScore عن اقتراح محرك القواعد
-- (computeOpportunityRiskSuggestion — Rule-Based، مبني على بيانات حقيقية) بأكتر من 25 نقطة.
-- إشارة مساءلة ("راجع الرقم ده") مش رفض — القيمة بتتحسب وقت الحفظ في src/app/analysis/actions.ts.
ALTER TABLE "ProductMarketAnalysis" ADD COLUMN "needsReview" BOOLEAN NOT NULL DEFAULT false;
