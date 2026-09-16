-- تحقيقًا لإلغاء تخصيص دفعة بأمان (BACKLOG.md § وحدة 8 — "مفيش فعل إلغاء تخصيص دفعة"):
-- 1) PaymentAllocation.journalEntryId يتتبّع قيد فرق العملة اللي postPaymentAllocated رحّله وقت
--    التخصيص (null لو مفيش)، عشان deletePaymentAllocationAction يقدر يعكسه بدل ما يفضل واقف.
-- 2) CommissionEntry.paymentAllocationId يتتبّع أي عمولة اتسجّلت تلقائيًا (accrueCommissionOnCollection)
--    نتيجة التخصيص ده بالظبط، عشان تتشال معاه لو لسه Accrued (مش Approved/Paid).

ALTER TABLE "PaymentAllocation" ADD COLUMN "journalEntryId" UUID;
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CommissionEntry" ADD COLUMN "paymentAllocationId" UUID;
ALTER TABLE "CommissionEntry" ADD CONSTRAINT "CommissionEntry_paymentAllocationId_fkey" FOREIGN KEY ("paymentAllocationId") REFERENCES "PaymentAllocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "CommissionEntry_paymentAllocationId_idx" ON "CommissionEntry"("paymentAllocationId");
