-- AddForeignKey
ALTER TABLE "CommissionEntry" ADD CONSTRAINT "CommissionEntry_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============ إنفاذ سداد العمولة: مرفوض بلا قيد محاسبي فعلي ============
-- docs/ERD.md لم يشترط ده صراحةً، لكن نفس فئة العيب اللي اتصلحت 4 مرات في الجلسة دي
-- (TaxRecord.filingStatus=Paid، CAPA.status=Closed، BankReconciliation.status=Reconciled):
-- تأكيد حالة نهائية "مدفوع" بلا الحدث المحاسبي اللي يبررها. كان journalEntryId عمود خام بلا
-- علاقة (وحدة 8 مش مبنية) — دلوقتي FK حقيقي، والتريجر ده بيمنع الالتفاف حوله.
CREATE OR REPLACE FUNCTION public.enforce_commission_entry_paid()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF NEW."status" = 'Paid' AND NEW."journalEntryId" IS NULL THEN
    RAISE EXCEPTION 'مينفعش تعليم عمولة "مدفوعة" بلا قيد محاسبي فعلي (journalEntryId)'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.enforce_commission_entry_paid() FROM PUBLIC;

CREATE TRIGGER commission_entry_paid_check
  BEFORE INSERT OR UPDATE ON "CommissionEntry"
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_commission_entry_paid();
