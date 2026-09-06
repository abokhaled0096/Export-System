-- آلية سعر الصرف كانت شكلية — CostItem مكانش فيه عمود currency خاص بيه، فأي بند تكلفة كان
-- مفروض ضمنيًا إنه بنفس عملة السيناريو من غير أي تحقق أو تحويل. راجع STATUS.md § آلية سعر الصرف.

ALTER TABLE "CostItem" ADD COLUMN "currency" CHAR(3);
ALTER TABLE "CostItem" ADD COLUMN "fxRateId" UUID;

-- تعبئة الصفوف الموجودة: كل بند تكلفة قديم كان مفروض ضمنيًا بنفس عملة السيناريو بتاعه.
UPDATE "CostItem" ci
SET "currency" = ds."currency"
FROM "DealScenario" ds
WHERE ci."scenarioId" = ds."id";

ALTER TABLE "CostItem" ALTER COLUMN "currency" SET NOT NULL;

ALTER TABLE "CostItem" ADD CONSTRAINT "CostItem_fxRateId_fkey" FOREIGN KEY ("fxRateId") REFERENCES "ExchangeRate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
