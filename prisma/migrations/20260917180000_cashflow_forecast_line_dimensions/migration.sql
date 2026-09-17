-- أبعاد اختيارية على التوقّع اليدوي للتدفّق النقدي (BACKLOG.md § وحدة 8 — الشريحة 2 من
-- خطة إقفال باقي البنود). نفس نمط JournalLine.costCenterId/profitCenterId — وسم تحليلي
-- اختياري، مش هوية الصف (الـ@@unique القديم بلا الأبعاد لسه شغّال لو الحقلين NULL).
ALTER TABLE "CashFlowForecastLine" ADD COLUMN "costCenterId" UUID,
ADD COLUMN "profitCenterId" UUID;

ALTER TABLE "CashFlowForecastLine" ADD CONSTRAINT "CashFlowForecastLine_costCenterId_fkey"
  FOREIGN KEY ("costCenterId") REFERENCES "CostCenter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CashFlowForecastLine" ADD CONSTRAINT "CashFlowForecastLine_profitCenterId_fkey"
  FOREIGN KEY ("profitCenterId") REFERENCES "ProfitCenter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "CashFlowForecastLine_costCenterId_idx" ON "CashFlowForecastLine"("costCenterId");
CREATE INDEX "CashFlowForecastLine_profitCenterId_idx" ON "CashFlowForecastLine"("profitCenterId");

DROP INDEX "CashFlowForecastLine_orgId_weekStartDate_category_currency_key";
CREATE UNIQUE INDEX "CashFlowForecastLine_orgId_weekStartDate_category_currency_costCenterId_profitCenterId_key"
  ON "CashFlowForecastLine"("orgId", "weekStartDate", "category", "currency", "costCenterId", "profitCenterId");
